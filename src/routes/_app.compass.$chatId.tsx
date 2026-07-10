import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendCompassMessage } from "@/lib/compass.functions";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Compass, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/compass/$chatId")({
  head: () => ({ meta: [{ title: "Compass — Academic Compass" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ seed: typeof s.seed === "string" ? s.seed : undefined }),
  component: ChatPage,
});

type Msg = { id: string; role: string; content: string; created_at: string };

function ChatPage() {
  const { chatId } = Route.useParams();
  const { seed } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const send = useServerFn(sendCompassMessage);
  const [input, setInput] = useState(seed ?? "");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatQuery = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const [{ data: chat }, { data: messages }] = await Promise.all([
        supabase.from("chats").select("*").eq("id", chatId).maybeSingle(),
        supabase.from("chat_messages").select("*").eq("chat_id", chatId).order("created_at"),
      ]);
      return { chat, messages: (messages ?? []) as Msg[] };
    },
  });

  useEffect(() => { inputRef.current?.focus(); }, [chatId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatQuery.data?.messages.length, thinking]);

  async function submit() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setThinking(true);
    // Optimistic: push into cache
    qc.setQueryData(["chat", chatId], (prev: { chat: unknown; messages: Msg[] } | undefined) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, { id: `temp-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() }] };
    });
    try {
      await send({ data: { chat_id: chatId, content } });
      await qc.invalidateQueries({ queryKey: ["chat", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setThinking(false);
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const messages = chatQuery.data?.messages ?? [];

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/compass" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Chats
        </Link>
        <p className="truncate text-sm font-medium">{chatQuery.data?.chat?.title ?? "Chat"}</p>
        <span />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card">
        {messages.length === 0 && !thinking ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium">Ask Compass anything.</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              I can explain concepts, plan your day, prioritize assignments, and quiz you before exams.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {messages.map((m) => <Message key={m.id} msg={m} />)}
            {thinking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Compass className="h-4 w-4 animate-pulse text-primary" />
                Compass is thinking<span className="animate-pulse">…</span>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/40"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="Ask Compass…"
          className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={sending || !input.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function Message({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-3.5 w-3.5" />
      </div>
      <div className="prose prose-sm max-w-none flex-1 text-foreground dark:prose-invert prose-p:leading-relaxed prose-pre:rounded-xl prose-pre:bg-secondary prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
      </div>
    </div>
  );
}
