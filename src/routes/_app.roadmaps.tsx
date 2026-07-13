import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toggleMilestone, regenerateRoadmap } from "@/lib/assignments.functions";
import { analytics } from "@/lib/analytics";
import { Map as MapIcon, Undo2, Check, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/roadmaps")({
  head: () => ({ meta: [{ title: "Roadmaps — Academic Compass" }] }),
  validateSearch: (s: Record<string, unknown>): { assignment?: string } =>
    typeof s.assignment === "string" ? { assignment: s.assignment } : {},
  component: RoadmapsPage,
});

type Milestone = {
  id: string;
  step: string;
  description: string | null;
  estimated_time: string | null;
  completed: boolean;
  assignment_id: string;
  order_index: number;
};

type AssignmentLite = {
  id: string;
  title: string;
  subject: string | null;
  deadline: string | null;
  estimated_hours: number | null;
  status: string;
  archived_at: string | null;
};

function RoadmapsPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const toggle = useServerFn(toggleMilestone);
  const regen = useServerFn(regenerateRoadmap);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const assignmentsQuery = useQuery({
    queryKey: ["roadmaps-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, subject, deadline, estimated_hours, status, archived_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignmentLite[];
    },
  });

  const assignments = assignmentsQuery.data ?? [];
  const selectedId = search.assignment ?? assignments[0]?.id ?? null;
  const selected = assignments.find((a) => a.id === selectedId) ?? null;

  const milestonesQuery = useQuery({
    queryKey: ["roadmap", selectedId],
    queryFn: async () => {
      if (!selectedId) return [] as Milestone[];
      const { data, error } = await supabase
        .from("roadmaps")
        .select("id, step, description, estimated_time, completed, assignment_id, order_index")
        .eq("assignment_id", selectedId)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
    enabled: !!selectedId,
  });

  const milestones = milestonesQuery.data ?? [];
  const done = milestones.filter((m) => m.completed).length;
  const total = milestones.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const remainingHours = useMemo(() => {
    if (!selected?.estimated_hours || !total) return null;
    return Math.max(0, Math.round(selected.estimated_hours * (1 - done / total)));
  }, [selected, done, total]);

  async function onToggle(id: string, completed: boolean) {
    try {
      await toggle({ data: { id, completed } });
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onRegenerate() {
    if (!selectedId) return;
    setRegenLoading(true);
    try {
      await regen({ data: { id: selectedId } });
      analytics.roadmapRegenerated({
        assignment_id: selectedId,
        subject: selected?.subject ?? null,
        total_tasks_generated: total,
      });
      toast.success("Roadmap regenerated");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate");
    } finally {
      setRegenLoading(false);
      setConfirmRegen(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Roadmaps</h1>
          <p className="mt-2 text-muted-foreground">Milestones for each assignment — sequenced by Compass.</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <MapIcon className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 text-sm font-medium">No roadmap generated yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload an assignment to see your first roadmap.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Assignment selector */}
          <aside className="space-y-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Assignments</p>
            {assignments.map((a) => {
              const active = a.id === selectedId;
              return (
                <button
                  key={a.id}
                  onClick={() => navigate({ search: { assignment: a.id } })}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    active ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span className="truncate">{a.title}</span>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              );
            })}
          </aside>

          {/* Roadmap detail */}
          <section className="rounded-2xl border border-border bg-card">
            {!selected ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Select an assignment</div>
            ) : (
              <>
                <div className="border-b border-border p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/assignments/$id"
                        params={{ id: selected.id }}
                        className="text-lg font-semibold tracking-tight hover:text-primary"
                      >
                        {selected.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {selected.subject && <span className="rounded-full bg-secondary px-2 py-0.5">{selected.subject}</span>}
                        {selected.deadline && <span>Due {new Date(selected.deadline).toLocaleDateString()}</span>}
                        <span>{done}/{total} done · {pct}%</span>
                        {remainingHours != null && <span>~{remainingHours}h remaining</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmRegen(true)}
                      disabled={regenLoading}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      {regenLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Regenerate roadmap
                    </button>
                  </div>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {milestonesQuery.isLoading ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </div>
                ) : milestones.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No milestones yet. Regenerate to create them.
                  </div>
                ) : (
                  <ol className="space-y-2 p-5">
                    {milestones.map((m, i) => (
                      <li key={m.id} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-secondary/50">
                        <button
                          onClick={() => onToggle(m.id, !m.completed)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                            m.completed ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                          }`}
                          aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                        >
                          {m.completed && <Check className="h-3 w-3" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm ${m.completed ? "text-muted-foreground line-through" : "font-medium"}`}>
                              {i + 1}. {m.step}
                            </p>
                            <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              {m.estimated_time ?? "—"}
                            </span>
                          </div>
                          {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                          {m.completed && (
                            <button
                              onClick={() => onToggle(m.id, false)}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Undo2 className="h-3 w-3" /> Mark incomplete
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this roadmap?</AlertDialogTitle>
            <AlertDialogDescription>
              Compass will re-analyze the assignment and replace all existing milestones. Your completion progress will reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep existing roadmap</AlertDialogCancel>
            <AlertDialogAction onClick={onRegenerate} disabled={regenLoading}>
              {regenLoading ? "Regenerating…" : "Generate new roadmap"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
