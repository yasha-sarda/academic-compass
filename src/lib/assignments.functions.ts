import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiAnalysis = {
  title: string;
  summary: string;
  detected_subject?: string | null;
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
    detected_subject: input.subject ?? null,
    difficulty,
    estimated_hours,
    priority,
    confidence: 0.5,
    reasoning: `Compass could not fully read the source, so this is a heuristic estimate based on the ${input.source_type} you provided${input.deadline ? ` and a ${daysToDeadline}-day window` : ""}.`,
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

type FileAttachment = { mime: string; base64: string; name: string };

async function callLovableAi(
  input: ExtractInput,
  attachment: FileAttachment | null,
): Promise<AiAnalysis | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const today = new Date().toISOString();
  const system = `You are Compass, an AI academic copilot. You will receive an assignment brief (as a PDF, image, or pasted text). Read the entire document carefully and UNDERSTAND what the assignment is actually asking — do not just echo raw text.

Extract as much information as you can confidently identify: assignment title, subject, course/module code, deadline (interpret natural phrases like "submit before next Monday" using today's date ${today}), a clear description of the task, individual questions or sections, instructions, marks/weightage, submission method, important notes, key topics/keywords, and any technologies mentioned.

Then estimate the workload realistically for a university student.

Return STRICT JSON matching this TypeScript type — no markdown, no prose:
{
  "title": string,                                    // concise, human-readable assignment title
  "detected_subject": string | null,                  // subject / course name if you can tell
  "summary": string,                                  // multi-paragraph description of what the assignment is about, what needs to be done, structured sections/questions, marks, submission method, and important notes. Use short headings prefixed with "## " where helpful.
  "difficulty": "Easy"|"Medium"|"Hard",
  "estimated_hours": number,
  "priority": "Low"|"Medium"|"High",
  "confidence": number,                               // 0-1, how confident you are you actually understood the document
  "reasoning": string,                                // 1-3 sentence explanation of your effort/priority estimate
  "deliverables": string[],                           // concrete artifacts the student must submit
  "skills_required": string[],
  "tags": string[],                                   // keywords/topics/technologies detected in the brief
  "deadline_candidates": string[],                    // ISO 8601 datetimes for every deadline you detect, in priority order (best guess first). Empty array if none.
  "milestones": { "title": string, "description": string, "estimated_time": string }[]  // 4-7 concrete steps that make a realistic roadmap for this SPECIFIC assignment
}

If the document is unreadable or clearly not an academic assignment, still return valid JSON with your best-effort fields and a low confidence value.`;

  const userTextParts: string[] = [];
  if (input.title) userTextParts.push(`Student-provided title: ${input.title}`);
  if (input.subject) userTextParts.push(`Student-selected subject: ${input.subject}`);
  if (input.deadline) userTextParts.push(`Student-provided deadline (ISO): ${input.deadline}`);
  if (input.notes) userTextParts.push(`Student notes: ${input.notes}`);
  if (input.source_text) userTextParts.push(`Assignment text:\n${input.source_text.slice(0, 20000)}`);
  if (attachment) userTextParts.push(`An assignment ${attachment.mime.startsWith("image/") ? "image" : "document"} is attached — read it end-to-end before analyzing.`);
  if (userTextParts.length === 0) userTextParts.push("Analyze the attached assignment.");

  const contentBlocks: Array<Record<string, unknown>> = [
    { type: "text", text: userTextParts.join("\n\n") },
  ];

  if (attachment) {
    if (attachment.mime.startsWith("image/")) {
      contentBlocks.push({
        type: "image_url",
        image_url: { url: `data:${attachment.mime};base64,${attachment.base64}` },
      });
    } else if (attachment.mime === "application/pdf") {
      contentBlocks.push({
        type: "file",
        file: {
          filename: attachment.name,
          file_data: `data:application/pdf;base64,${attachment.base64}`,
        },
      });
    }
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: contentBlocks },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[compass] gateway non-OK", res.status, txt.slice(0, 400));
      return null;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<AiAnalysis>;
    return {
      title: parsed.title?.trim() || input.title || "Untitled",
      summary: parsed.summary ?? "",
      detected_subject: parsed.detected_subject ?? input.subject ?? null,
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

async function loadAttachment(
  supabase: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  input: ExtractInput,
): Promise<FileAttachment | null> {
  if (!input.file_url) return null;
  if (input.source_type !== "pdf" && input.source_type !== "image") return null;
  try {
    const { data, error } = await supabase.storage.from("assignments").download(input.file_url);
    if (error || !data) {
      console.error("[compass] download failed", error);
      return null;
    }
    const buf = await data.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Base64 encode in chunks to avoid stack overflow
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const inferredMime =
      input.source_type === "pdf"
        ? "application/pdf"
        : /\.png$/i.test(input.file_name ?? "")
          ? "image/png"
          : "image/jpeg";
    return { mime: inferredMime, base64, name: input.file_name ?? "assignment" };
  } catch (err) {
    console.error("[compass] attachment error", err);
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
  .handler(async ({ data, context }) => {
    const attachment = await loadAttachment(context.supabase, data);
    const analysis = (await callLovableAi(data, attachment)) ?? fallbackAnalysis(data);
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

    const { data: all } = await context.supabase.from("roadmaps").select("completed").eq("assignment_id", m.assignment_id);
    if (all && all.length) {
      const done = all.filter((r) => r.completed).length;
      const pct = Math.round((done / all.length) * 100);
      await context.supabase
        .from("assignments")
        .update({
          progress: pct,
          status: pct >= 100 ? "completed" : pct > 0 ? "in_progress" : "pending",
          completed_at: pct >= 100 ? new Date().toISOString() : null,
        })
        .eq("id", m.assignment_id);
    }
    return { ok: true };
  });

// Set assignment status (mark completed, restore to active)
export const setAssignmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string; status: "pending" | "in_progress" | "completed" };
    if (!o?.id || !o.status) throw new Error("id and status required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const patch: {
      status: string;
      completed_at: string | null;
      progress: number;
    } = { status: data.status, completed_at: null, progress: 0 };
    if (data.status === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.progress = 100;
      await context.supabase
        .from("roadmaps")
        .update({ completed: true })
        .eq("assignment_id", data.id);
    } else {
      patch.completed_at = null;
      const { data: ms } = await context.supabase.from("roadmaps").select("completed").eq("assignment_id", data.id);
      const total = ms?.length ?? 0;
      const done = (ms ?? []).filter((r) => r.completed).length;
      patch.progress = total ? Math.round((done / total) * 100) : 0;
    }
    const { error } = await context.supabase
      .from("assignments")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Regenerate roadmap for an assignment: delete existing milestones and re-analyze from stored context
export const regenerateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string };
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const { data: a, error } = await context.supabase
      .from("assignments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !a) throw new Error(error?.message ?? "Assignment not found");

    const input: ExtractInput = {
      title: a.title,
      subject: a.subject,
      deadline: a.deadline,
      notes: a.notes,
      source_type: (a.source_type as ExtractInput["source_type"]) ?? "text",
      source_text: a.source_text,
      file_url: a.file_url,
      file_name: null,
    };
    const attachment = await loadAttachment(context.supabase, input);
    const analysis = (await callLovableAi(input, attachment)) ?? fallbackAnalysis(input);

    await context.supabase.from("roadmaps").delete().eq("assignment_id", data.id);
    const rows = analysis.milestones.map((m, i) => ({
      assignment_id: data.id,
      step: m.title,
      description: m.description,
      estimated_time: m.estimated_time,
      order_index: i,
    }));
    if (rows.length) await context.supabase.from("roadmaps").insert(rows);

    await context.supabase
      .from("assignments")
      .update({ progress: 0, status: "pending", completed_at: null })
      .eq("id", data.id);

    return { ok: true, count: rows.length };
  });
