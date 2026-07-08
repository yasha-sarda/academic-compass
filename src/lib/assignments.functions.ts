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
  milestones: Array<{ title: string; description: string; estimated_time: string }>;
};

type AnalyzeInput = {
  title?: string;
  subject?: string | null;
  deadline?: string | null;
  notes?: string | null;
  source_type: "pdf" | "image" | "text" | "docx";
  source_text?: string | null;
  file_url?: string | null;
  file_name?: string | null;
};

function isAnalyzeInput(v: unknown): v is AnalyzeInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.source_type === "string";
}

function fallbackAnalysis(input: AnalyzeInput): AiAnalysis {
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
    reasoning: `Based on the ${input.source_type} source${input.deadline ? ` and a ${daysToDeadline}-day window` : ""}, a ${priority.toLowerCase()}-priority ${difficulty.toLowerCase()} workload is likely. Placeholder analysis — connect an AI key to generate live output.`,
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
    milestones: [
      { title: "Research", description: "Gather sources and clarify scope.", estimated_time: "45 mins" },
      { title: "Outline", description: "Draft structure and key arguments.", estimated_time: "60 mins" },
      { title: "Implementation", description: "Produce the main deliverable.", estimated_time: `${Math.max(1, estimated_hours - 3)} hrs` },
      { title: "Review", description: "Self-review and refine.", estimated_time: "1 hr" },
      { title: "Finalize", description: "Polish, format, and submit.", estimated_time: "45 mins" },
    ],
  };
}

async function callLovableAi(input: AnalyzeInput): Promise<AiAnalysis | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const system = `You are an academic copilot. Analyze the student's assignment and return STRICT JSON matching this TypeScript type:
{ "title": string, "summary": string, "difficulty": "Easy"|"Medium"|"Hard", "estimated_hours": number, "priority": "Low"|"Medium"|"High", "confidence": number (0-1), "reasoning": string, "deliverables": string[], "skills_required": string[], "milestones": {"title": string, "description": string, "estimated_time": string}[] }
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
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
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
    return JSON.parse(content) as AiAnalysis;
  } catch (err) {
    console.error("[ai] gateway call failed", err);
    return null;
  }
}

export const analyzeAndSaveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!isAnalyzeInput(data)) throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ai = (await callLovableAi(data)) ?? fallbackAnalysis(data);

    const { data: inserted, error } = await supabase
      .from("assignments")
      .insert({
        user_id: userId,
        title: ai.title || data.title || "Untitled assignment",
        subject: data.subject ?? null,
        deadline: data.deadline ?? null,
        notes: data.notes ?? null,
        source_type: data.source_type,
        source_text: data.source_text ?? null,
        file_url: data.file_url ?? null,
        summary: ai.summary,
        difficulty: ai.difficulty,
        priority: ai.priority,
        estimated_hours: ai.estimated_hours,
        confidence: ai.confidence,
        reasoning: ai.reasoning,
        deliverables: ai.deliverables,
        skills_required: ai.skills_required,
        status: "pending",
        description: ai.summary,
      })
      .select()
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to save assignment");

    const milestoneRows = ai.milestones.map((m, i) => ({
      assignment_id: inserted.id,
      step: m.title,
      description: m.description,
      estimated_time: m.estimated_time,
      order_index: i,
    }));
    if (milestoneRows.length) {
      await supabase.from("roadmaps").insert(milestoneRows);
    }

    await supabase.from("ai_logs").insert({
      assignment_id: inserted.id,
      prompt: JSON.stringify({ source_type: data.source_type, title: data.title }),
      response: JSON.stringify(ai),
    });

    return { id: inserted.id };
  });
