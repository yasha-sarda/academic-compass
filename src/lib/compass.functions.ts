import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are Compass — an AI academic copilot for university students. Your job is to reduce decision paralysis and help students figure out what to work on next.

Rules:
- Always explain WHY, not just WHAT.
- Be concise, warm, and structured. Use markdown (headings, lists, code blocks) when helpful.
- When given an assignment context, refer to it directly by title and deadline.
- If asked "what should I do next", pick ONE clear next action with a brief reason.
- Never invent facts about the student's coursework. Ask if unsure.`;

type SendMessageInput = {
  chat_id: string;
  content: string;
};

function isSendInput(v: unknown): v is SendMessageInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.chat_id === "string" && typeof o.content === "string";
}

async function buildAssignmentContext(
  supabase: ReturnType<typeof requireSupabaseAuth extends never ? never : any>,
  assignmentId: string | null,
): Promise<string | null> {
  if (!assignmentId) return null;
  const [{ data: a }, { data: milestones }] = await Promise.all([
    supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle(),
    supabase.from("roadmaps").select("*").eq("assignment_id", assignmentId).order("order_index"),
  ]);
  if (!a) return null;
  const doneCount = (milestones ?? []).filter((m: { completed: boolean }) => m.completed).length;
  const total = milestones?.length ?? 0;
  return `ASSIGNMENT CONTEXT
Title: ${a.title}
Subject: ${a.subject ?? "—"}
Deadline: ${a.deadline ?? "—"}
Priority: ${a.priority ?? "—"} | Difficulty: ${a.difficulty ?? "—"}
Estimated hours: ${a.estimated_hours ?? "—"}
Progress: ${a.progress ?? 0}% (${doneCount}/${total} milestones)
Summary: ${a.summary ?? "—"}
Description: ${a.description ?? "—"}
Milestones:
${(milestones ?? []).map((m: { step: string; completed: boolean; estimated_time: string | null }, i: number) => `${i + 1}. [${m.completed ? "x" : " "}] ${m.step} (${m.estimated_time ?? "?"})`).join("\n")}`;
}

export const sendCompassMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!isSendInput(data)) throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership & get assignment_id
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("id, assignment_id, user_id")
      .eq("id", data.chat_id)
      .maybeSingle();
    if (chatErr || !chat || chat.user_id !== userId) throw new Error("Chat not found");

    // Persist user message
    await supabase.from("chat_messages").insert({ chat_id: data.chat_id, role: "user", content: data.content });

    // Load full history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_id", data.chat_id)
      .order("created_at");

    const contextBlock = await buildAssignmentContext(supabase, chat.assignment_id);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    if (contextBlock) messages.push({ role: "system", content: contextBlock });
    for (const m of history ?? []) {
      if (m.role === "user" || m.role === "assistant" || m.role === "system") {
        messages.push({ role: m.role, content: m.content });
      }
    }

    const key = process.env.LOVABLE_API_KEY;
    let assistantContent = "";
    if (key) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({ model: "openai/gpt-5.5", messages }),
        });
        if (res.ok) {
          const json = await res.json();
          assistantContent = json?.choices?.[0]?.message?.content ?? "";
        } else {
          assistantContent = `I hit an error reaching the model (${res.status}). Please try again.`;
        }
      } catch (err) {
        console.error("[compass chat] error", err);
        assistantContent = "I couldn't reach the model. Please try again in a moment.";
      }
    } else {
      assistantContent = "Compass is running in demo mode — connect an AI key to get live answers.";
    }

    await supabase.from("chat_messages").insert({
      chat_id: data.chat_id,
      role: "assistant",
      content: assistantContent,
    });

    // Auto-title chat from first user message
    if ((history?.length ?? 0) <= 1) {
      const title = data.content.slice(0, 60).trim();
      await supabase.from("chats").update({ title, updated_at: new Date().toISOString() }).eq("id", data.chat_id);
    } else {
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", data.chat_id);
    }

    return { content: assistantContent };
  });

export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = (data ?? {}) as { assignment_id?: string | null; title?: string };
    return o;
  })
  .handler(async ({ data, context }) => {
    const { data: chat, error } = await context.supabase
      .from("chats")
      .insert({
        user_id: context.userId,
        assignment_id: data.assignment_id ?? null,
        title: data.title ?? "New chat",
      })
      .select()
      .single();
    if (error || !chat) throw new Error(error?.message ?? "Failed to create chat");
    return { id: chat.id };
  });

export const renameChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string; title: string };
    if (!o?.id || !o.title) throw new Error("id and title required");
    return o;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chats")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const o = data as { id: string };
    if (!o?.id) throw new Error("id required");
    return o;
  })
  .handler(async ({ data, context }) => {
    await context.supabase.from("chat_messages").delete().eq("chat_id", data.id);
    const { error } = await context.supabase.from("chats").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
