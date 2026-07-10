import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toggleMilestone } from "@/lib/assignments.functions";
import { ChevronDown, ChevronRight, Map, Undo2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/roadmaps")({
  head: () => ({ meta: [{ title: "Roadmaps — Academic Compass" }] }),
  component: RoadmapsPage,
});

type Row = {
  id: string;
  step: string;
  description: string | null;
  estimated_time: string | null;
  duration: number | null;
  completed: boolean;
  assignment_id: string;
  assignments: { title: string; deadline: string | null; estimated_hours: number | null; archived_at: string | null };
};

function RoadmapsPage() {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleMilestone);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["roadmaps-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmaps")
        .select("id, step, description, estimated_time, duration, completed, assignment_id, assignments!inner(title, deadline, estimated_hours, archived_at)")
        .order("order_index");
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).filter((r) => !r.assignments.archived_at);
    },
  });

  const groups = new Map<string, { title: string; deadline: string | null; hours: number | null; items: Row[] }>();
  for (const r of query.data ?? []) {
    const g = groups.get(r.assignment_id) ?? { title: r.assignments.title, deadline: r.assignments.deadline, hours: r.assignments.estimated_hours, items: [] };
    g.items.push(r);
    groups.set(r.assignment_id, g);
  }

  async function onToggle(id: string, completed: boolean) {
    try {
      await toggle({ data: { id, completed } });
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Roadmaps</h1>
      <p className="mt-2 text-muted-foreground">Milestones across all your assignments — sequenced by Compass.</p>

      {(query.data?.length ?? 0) === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <Map className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 text-sm font-medium">No roadmap generated yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload an assignment to see your first roadmap.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {Array.from(groups.entries()).map(([id, g]) => {
            const done = g.items.filter((x) => x.completed).length;
            const total = g.items.length;
            const pct = Math.round((done / total) * 100);
            const remainingHours = g.hours ? Math.max(0, Math.round(g.hours * (1 - done / total))) : null;
            const open = expanded[id] !== false; // default open
            return (
              <section key={id} className="rounded-2xl border border-border bg-card">
                <button onClick={() => setExpanded({ ...expanded, [id]: !open })} className="flex w-full items-center justify-between gap-3 p-5 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <Link to="/assignments/$id" params={{ id }} className="text-sm font-medium hover:text-primary" onClick={(e) => e.stopPropagation()}>{g.title}</Link>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{done}/{total} done · {pct}%</span>
                      {remainingHours != null && <span>· ~{remainingHours}h remaining</span>}
                      {g.deadline && <span>· due {new Date(g.deadline).toLocaleDateString()}</span>}
                    </div>
                    <div className="mt-2 h-1 w-64 max-w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>

                {open && (
                  <ol className="border-t border-border px-5 py-4 space-y-2">
                    {g.items.map((m, i) => (
                      <li key={m.id} className="flex items-start gap-3 rounded-xl p-3 hover:bg-secondary/50">
                        <button onClick={() => onToggle(m.id, !m.completed)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${m.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {m.completed && <Check className="h-3 w-3" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm ${m.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{i + 1}. {m.step}</p>
                            <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{m.estimated_time ?? "—"}</span>
                          </div>
                          {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                          {m.completed && (
                            <button onClick={() => onToggle(m.id, false)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Undo2 className="h-3 w-3" /> Undo
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
