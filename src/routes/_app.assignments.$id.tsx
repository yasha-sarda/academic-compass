import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowLeft, Brain, Clock, Sparkles, Target, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/assignments/$id")({
  head: () => ({ meta: [{ title: "Assignment — Academic Copilot" }] }),
  component: AssignmentDetail,
});

function priorityTone(p: string | null | undefined) {
  if (p === "High") return "bg-red-50 text-red-700 border-red-200";
  if (p === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}
function difficultyTone(d: string | null | undefined) {
  if (d === "Hard") return "bg-purple-50 text-purple-700 border-purple-200";
  if (d === "Medium") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function AssignmentDetail() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const [{ data: a, error: ae }, { data: m, error: me }] = await Promise.all([
        supabase.from("assignments").select("*").eq("id", id).maybeSingle(),
        supabase.from("roadmaps").select("*").eq("assignment_id", id).order("order_index"),
      ]);
      if (ae) throw ae;
      if (me) throw me;
      return { assignment: a, milestones: m ?? [] };
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const a = query.data?.assignment;
  if (!a) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/assignments" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline h-3.5 w-3.5" /> All assignments
        </Link>
        <p className="mt-8 text-sm text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  const milestones = query.data!.milestones;
  const deliverables = (a.deliverables ?? []) as string[];
  const skills = (a.skills_required ?? []) as string[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All assignments
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {a.subject && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
            {a.subject}
          </span>
        )}
        <span className={`rounded-full border px-2.5 py-0.5 text-xs ${priorityTone(a.priority)}`}>
          {a.priority ?? "Priority"} priority
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs ${difficultyTone(a.difficulty)}`}>
          {a.difficulty ?? "Difficulty"}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{a.title}</h1>
      {a.summary && <p className="mt-3 text-muted-foreground">{a.summary}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat icon={Clock} label="Estimated hours" value={a.estimated_hours ? `${a.estimated_hours}h` : "—"} />
        <Stat icon={Target} label="Deadline" value={a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"} />
        <Stat icon={Zap} label="Confidence" value={a.confidence != null ? `${Math.round(Number(a.confidence) * 100)}%` : "—"} />
      </div>

      {a.reasoning && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" /> Reasoning
          </div>
          <p className="mt-3 text-sm">{a.reasoning}</p>
        </section>
      )}

      {(deliverables.length > 0 || skills.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {deliverables.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Deliverables
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary" /> {d}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {skills.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Skills required
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {milestones.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Roadmap
          </div>
          <div className="mt-4 space-y-3">
            {milestones.map((m, i) => (
              <div key={m.id}>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{m.step}</p>
                      {m.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                      {m.estimated_time ?? (m.duration ? `${m.duration} mins` : "—")}
                    </span>
                  </div>
                </div>
                {i < milestones.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
