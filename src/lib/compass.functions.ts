import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are Compass — a personal academic assistant for a specific university student. You already know their profile, subjects, assignments, deadlines, roadmaps, milestones, and progress from the context blocks below. NEVER ask the student to repeat information that is present in those context blocks. Refer to assignments by title, cite deadlines and progress, and recommend specific next actions with brief reasoning. Use markdown (headings, lists, tables, code blocks) when helpful. Be warm, concise, and structured. When asked "what should I do next" or "plan my day", pick concrete assignments and milestones from the context and explain WHY. If the student truly did not provide something (e.g. exam date), only then ask.`;

type SendMessageInput = {
  chat_id: string;
  content: string;
};

function isSendInput(v: unknown): v is SendMessageInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.chat_id === "string" && typeof o.content === "string";
}

// Full student context. If assignmentId is provided, that assignment is highlighted.
async function buildStudentContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  focusedAssignmentId: string | null,
): Promise<string> {
  const [{ data: profile }, { data: assignments }, { data: roadmaps }, { data: recentChats }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("assignments").select("*").eq("user_id", userId).order("deadline", { ascending: true, nullsFirst: false }),
    supabase.from("roadmaps").select("*").order("order_index"),
    supabase
      .from("chats")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const profileBlock = profile
    ? `STUDENT PROFILE
Name: ${profile.full_name ?? "—"}
College / University: ${profile.college ?? profile.university ?? "—"}
Course: ${profile.course ?? "—"}
Branch: ${profile.branch ?? "—"}
Semester: ${profile.semester ?? "—"}
Subjects: ${(profile.subjects ?? []).join(", ") || "—"}
Daily study goal: ${profile.daily_study_hours ? `${profile.daily_study_hours} hours` : "—"}
Preferred study time: ${profile.preferred_study_time ?? "—"}`
    : "STUDENT PROFILE\nNot filled in yet.";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allAssignments = (assignments ?? []) as any[];
  const active = allAssignments.filter((a) => !a.archived_at && a.status !== "completed");
  const completed = allAssignments.filter((a) => a.status === "completed");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roadmapsByAssignment = new Map<string, any[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (roadmaps ?? []) as any[]) {
    const arr = roadmapsByAssignment.get(r.assignment_id) ?? [];
    arr.push(r);
    roadmapsByAssignment.set(r.assignment_id, arr);
  }

  function fmtDeadline(iso: string | null): string {
    if (!iso) return "no deadline";
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    return `${new Date(iso).toLocaleDateString()} (${days >= 0 ? `${days}d left` : `${-days}d overdue`})`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderAssignment(a: any, includeMilestones = false): string {
    const ms = roadmapsByAssignment.get(a.id) ?? [];
    const done = ms.filter((m) => m.completed).length;
    let out = `• "${a.title}" — ${a.subject ?? "no subject"} · ${a.priority ?? "?"} priority · ${a.difficulty ?? "?"} · due ${fmtDeadline(a.deadline)} · ${a.estimated_hours ?? "?"}h · ${a.progress ?? 0}% (${done}/${ms.length})`;
    if (includeMilestones && ms.length) {
      out +=
        "\n    Milestones:\n" +
        ms.map((m, i) => `    ${i + 1}. [${m.completed ? "x" : " "}] ${m.step} (${m.estimated_time ?? "?"})`).join("\n");
    }
    if (a.summary && includeMilestones) out += `\n    Summary: ${a.summary}`;
    return out;
  }

  const activeBlock =
    active.length === 0
      ? "ACTIVE ASSIGNMENTS\nNone."
      : `ACTIVE ASSIGNMENTS (${active.length})\n${active.map((a) => renderAssignment(a)).join("\n")}`;

  const completedBlock =
    completed.length === 0
      ? "COMPLETED ASSIGNMENTS\nNone."
      : `COMPLETED ASSIGNMENTS (${completed.length})\n${completed
          .slice(0, 10)
          .map((a) => renderAssignment(a))
          .join("\n")}`;

  const focused = focusedAssignmentId ? allAssignments.find((a) => a.id === focusedAssignmentId) : null;
  const focusBlock = focused
    ? `FOCUSED ASSIGNMENT (the student opened Compass from this assignment — answer questions about it by default)\n${renderAssignment(focused, true)}`
    : "";

  // Recommendation heuristic: highest priority + soonest deadline among active
  const rec = [...active]
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const pa = a.priority === "High" ? 3 : a.priority === "Medium" ? 2 : 1;
      const pb = b.priority === "High" ? 3 : b.priority === "Medium" ? 2 : 1;
      if (pa !== pb) return pb - pa;
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })[0];
  const recBlock = rec ? `TODAY'S RECOMMENDATION\n${renderAssignment(rec)}` : "";

  const chatsBlock =
    (recentChats ?? []).length === 0
      ? ""
      : `RECENT CONVERSATIONS\n${recentChats!.map((c: { title: string; updated_at: string }) => `• ${c.title} (${new Date(c.updated_at).toLocaleDateString()})`).join("\n")}`;

  return [profileBlock, focusBlock, recBlock, activeBlock, completedBlock, chatsBlock]
    .filter(Boolean)
    .join("\n\n");
}

export const sendCompassMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!isSendInput(data)) throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("id, assignment_id, user_id")
      .eq("id", data.chat_id)
      .maybeSingle();
    if (chatErr || !chat || chat.user_id !== userId) throw new Error("Chat not found");

    await supabase.from("chat_messages").insert({ chat_id: data.chat_id, role: "user", content: data.content });

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_id", data.chat_id)
      .order("created_at");

    const contextBlock = await buildStudentContext(supabase, userId, chat.assignment_id);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextBlock },
    ];
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
        } else if (res.status === 429) {
          assistantContent = "I'm being rate-limited right now. Please try again in a moment.";
        } else if (res.status === 402) {
          assistantContent = "The AI credits are exhausted. Please add credits from workspace billing settings.";
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
