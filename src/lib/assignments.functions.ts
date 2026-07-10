import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiAnalysis = {
  title: string;
  summary: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimated_hours: number;
  priority: "Low" | "Medium" | "High";
  confidence: number;
  reasoning: string;
  deliverables: string[];
  skills_required: string[];
  tags: string[];
  deadline_candidates: string[];
  milestones: Array<{ title: string; description: string; estimated_time: string }>;
};

type ExtractInput = {
  title?: string;
  subject?: string | null;
  deadline?: string | null;
  notes?: string | null;
  source_type: "pdf" | "image" | "text" | "docx";
  source_text?: string | null;
  file_url?: string | null;
  file_name?: string | null;
};

function isExtractInput(v: unknown): v is ExtractInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.source_type === "string";
}

function fallbackAnalysis(input: ExtractInput): AiAnalysis {
  const seed = (input.title || input.file_name || input.source_text || "assignment").toLowerCase();
  const hardWords = ["thesis", "capstone", "research", "algorithm", "distributed", "system"];
  const easyWords = ["quiz", "reflection", "reading", "summary"];
  const isHard = hardWords.some((w) => seed.includes(w));
  const isEasy = easyWords.some((w) => seed.includes(w));
  const difficulty: AiAnalysis["difficulty"] = isHard ? "Hard" : isEasy ? "Easy" : "Medium";
  const estimated_hours = difficulty === "Hard" ? 12 : difficulty === "Easy" ? 2 : 6;
  const daysToDeadline = input.deadline
    ? Math.max(0, Math.ceil((new Date(input.deadline).getTime() - Date.now()) / 86400000))
    : 14;
  const priority: AiAnalysis["priority"] =
    daysToDeadline <= 3 ? "High" : daysToDeadline <= 10 ? "Medium" : "Low";
  const title = input.title || input.file_name?.replace(/\.[^.]+$/, "") || "Untitled assignment";
  return {
    title,
    summary: `${title} appears to be a ${difficulty.toLowerCase()} ${input.subject ?? "coursework"} task. Focus on scoping requirements first, then execute in short deep-work blocks.`,
    difficulty,
    estimated_hours,
    priority,
    confidence: 0.72,
    reasoning: `Based on the ${input.source_type} source${input.deadline ? ` and a ${daysToDeadline}-day window` : ""}, a ${priority.toLowerCase()}-priority ${difficulty.toLowerCase()} workload is likely.`,
    deliverables:
      difficulty === "Hard"
        ? ["Written report", "Supporting artifacts", "Presentation"]
        : difficulty === "Easy"
          ? ["Short write-up"]
          : ["Written submission", "Supporting artifact"],
    skills_required:
      difficulty === "Hard"
        ? ["Research", "Analysis", "Technical writing"]
        : ["Reading comprehension", "Writing"],
    tags: [input.subject ?? "coursework", difficulty.toLowerCase()].filter(Boolean) as string[],
    deadline_candidates: input.deadline ? [input.deadline] : [],
    milestones: [
      { title: "Research", description: "Gather sources and clarify scope.", estimated_time: "45 mins" },
      { title: "Outline", description: "Draft structure and key arguments.", estimated_time: "60 mins" },
      { title: "Implementation", description: "Produce the main deliverable.", estimated_time: `${Math.max(1, estimated_hours - 3)} hrs` },
      { title: "Review", description: "Self-review and refine.", estimated_time: "1 hr" },
      { title: "Finalize", description: "Polish, format, and submit.", estimated_time: "45 mins" },
    ],
  };
}

async function callLovableAi(input: ExtractInput): Promise<AiAnalysis | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const system = `You are Compass, an academic copilot. Analyze the student's assignment and return STRICT JSON matching this TypeScript type:
{ "title": string, "summary": string, "difficulty": "Easy"|"Medium"|"Hard", "estimated_hours": number, "priority": "Low"|"Medium"|"High", "confidence": number (0-1), "reasoning": string, "deliverables": string[], "skills_required": string[], "tags": string[], "deadline_candidates": string[] (ISO datetimes you detect, empty if none), "milestones": {"title": string, "description": string, "estimated_time": string}[] }
Return ONLY JSON, no prose.`;
  const userPayload = {
    provided_title: input.title,
    subject: input.subject,
    deadline: input.deadline,
    notes: input.notes,
    source_type: input.source_type,
    file_name: input.file_name,
    content: input.source_text?.slice(0, 8000) ?? null,
  };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<AiAnalysis>;
    return {
      title: parsed.title ?? input.title ?? "Untitled",
      summary: parsed.summary ?? "",
      difficulty: (parsed.difficulty as AiAnalysis["difficulty"]) ?? "Medium",
      estimated_hours: Number(parsed.estimated_hours ?? 4),
      priority: (parsed.priority as AiAnalysis["priority"]) ?? "Medium",
      confidence: Number(parsed.confidence ?? 0.7),
      reasoning: parsed.reasoning ?? "",
      deliverables: parsed.deliverables ?? [],
      skills_required: parsed.skills_required ?? [],
      tags: parsed.tags ?? [],
      deadline_candidates: parsed.deadline_candidates ?? [],
      milestones: parsed.milestones ?? [],
    };
  } catch (err) {
    console.error("[compass] gateway call failed", err);
    return null;
  }
}

// STEP 1: Extract (does NOT save)
export const extractAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!isExtractInput(data)) throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data }) => {
    const analysis = (await callLovableAi(data)) ?? fallbackAnalysis(data);
    return { analysis };
  });

// STEP 2: Save (persist reviewed assignment + generate roadmap)
type SaveInput = {
  title: string;
  subject: string | null;
  deadline: string | null;
  description: string | null;
  notes: string | null;
  priority: "Low" | "Medium" | "High";
  difficulty: "Easy" | "Medium" | "Hard";
  estimated_hours: number;
  tags: string[];
  confidence: number;
  reasoning: string;
  summary: string;
  deliverables: string[];
  skills_required: string[];
  source_type: "pdf" | "image" | "text" | "docx";
  source_text: string | null;
  file_url: string | null;
  milestones: Array<{ title: string; description: string; estimated_time: string }>;
};

function isSaveInput(v: unknown): v is SaveInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.title === "string" && typeof o.source_type === "string";
}

export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!isSaveInput(data)) throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("assignments")
      .insert({
        user_id: userId,
        title: data.title,
        subject: data.subject,
        deadline: data.deadline,
        description: data.description ?? data.summary,
        notes: data.notes,
        source_type: data.source_type,
        source_text: data.source_text,
        file_url: data.file_url,
        summary: data.summary,
        difficulty: data.difficulty,
        priority: data.priority,
        estimated_hours: data.estimated_hours,
        confidence: data.confidence,
        reasoning: data.reasoning,
        deliverables: data.deliverables,
        skills_required: data.skills_required,
        tags: data.tags,
        status: "pending",
      })
      .select()
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to save assignment");

    const milestoneRows = data.milestones.map((m, i) => ({
      assignment_id: inserted.id,
      step: m.title,
      description: m.description,
      estimated_time: m.estimated_time,
      order_index: i,
    }));
    if (milestoneRows.length) await supabase.from("roadmaps").insert(milestoneRows);

    await supabase.from("ai_logs").insert({
      assignment_id: inserted.id,
      prompt: JSON.stringify({ source_type: data.source_type, title: data.title }),
      response: JSON.stringify(data),
    });

    return { id: inserted.id };
  });

// Update assignment
type UpdateInput = {
  id: string;
  title?: string;
  subject?: string | null;
  deadline?: string | null;
  description?: string | null;
  notes?: string | null;
  priority?: string;
  difficulty?: string;
  estimated_hours?: number;
  tags?: string[];
};

export const updateAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as UpdateInput;
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("assignments").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Archive / unarchive
export const setArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string; archived: boolean };
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("assignments")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Delete assignment (cascades to roadmaps and ai_logs via FK on delete cascade)
export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string };
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    // Explicit cleanup (in case cascade not set on ai_logs)
    await context.supabase.from("roadmaps").delete().eq("assignment_id", data.id);
    await context.supabase.from("ai_logs").delete().eq("assignment_id", data.id);
    const { error } = await context.supabase.from("assignments").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Toggle milestone
export const toggleMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string; completed: boolean };
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const { data: m, error: fetchErr } = await context.supabase
      .from("roadmaps")
      .select("assignment_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !m) throw new Error(fetchErr?.message ?? "Milestone not found");
    const { error } = await context.supabase.from("roadmaps").update({ completed: data.completed }).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Recompute assignment progress
    const { data: all } = await context.supabase.from("roadmaps").select("completed").eq("assignment_id", m.assignment_id);
    if (all && all.length) {
      const done = all.filter((r) => r.completed).length;
      const pct = Math.round((done / all.length) * 100);
      await context.supabase
        .from("assignments")
        .update({ progress: pct, status: pct >= 100 ? "completed" : "in_progress" })
        .eq("id", m.assignment_id);
    }
    return { ok: true };
  });
