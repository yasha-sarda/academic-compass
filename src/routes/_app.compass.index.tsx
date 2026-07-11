import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createChat, deleteChat, renameChat } from "@/lib/compass.functions";
import { MessageSquare, Plus, MoreHorizontal, Trash2, Edit3, Compass } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/compass/")({
  head: () => ({ meta: [{ title: "Compass — Academic Compass" }] }),
  component: CompassIndex,
});

const PROMPTS = [
  "Explain this concept",
  "Help me understand this assignment",
  "Generate notes",
  "Quiz me",
  "Summarize a PDF",
  "Plan today's study",
  "Prioritize my assignments",
  "Prepare me for exams",
];

function CompassIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const newChat = useServerFn(createChat);
  const del = useServerFn(deleteChat);
  const rename = useServerFn(renameChat);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chats").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function startNew(seedPrompt?: string) {
    try {
      const res = await newChat({ data: { title: seedPrompt ?? "New chat" } });
      navigate({
        to: "/compass/$chatId",
        params: { chatId: res.id },
        search: seedPrompt ? { seed: seedPrompt } : {},
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs text-primary">
            <Compass className="h-3 w-3" /> Compass
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hi! I'm Compass.</h1>
          <p className="mt-2 text-muted-foreground">
            I can help explain concepts, answer questions, create notes, plan assignments, and help you prepare for exams.
          </p>
        </div>
        <button onClick={() => startNew()} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> New chat
        </button>
      </div>

      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Quick prompts</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => startNew(p)} className="rounded-xl border border-border bg-card p-3 text-left text-sm transition hover:border-primary/40 hover:bg-secondary/50">
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent chats</p>
        {(chats.data?.length ?? 0) === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No conversations yet. Start one above.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {chats.data!.map((c) => (
              <li key={c.id} className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40">
                <Link to="/compass/$chatId" params={{ chatId: c.id }} search={{}} className="flex flex-1 items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-sm">{c.title}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRenaming({ id: c.id, title: c.title })}>
                      <Edit3 className="mr-2 h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={async () => {
                      await del({ data: { id: c.id } });
                      toast.success("Deleted");
                      qc.invalidateQueries({ queryKey: ["chats"] });
                    }}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-medium">Rename chat</h3>
            <input value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRenaming(null)} className="rounded-full border border-border px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={async () => {
                await rename({ data: { id: renaming.id, title: renaming.title.trim() || "Untitled" } });
                setRenaming(null);
                qc.invalidateQueries({ queryKey: ["chats"] });
              }} className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
