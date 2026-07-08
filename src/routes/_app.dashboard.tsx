import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, Clock, FileText, Sparkles, Target, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Academic Copilot" }] }),
  component: Dashboard,
});

type Assignment = {
  id: string;
  title: string;
  subject: string | null;
  deadline: string | null;
  priority: string | null;
  difficulty: string | null;
  estimated_hours: number | null;
  confidence: number | null;
  reasoning: string | null;
  created_at: string;
};

function scoreAssignment(a: Assignment): number {
  const now = Date.now();
  const daysLeft = a.deadline
    ? Math.max(0, (new Date(a.deadline).getTime() - now) / 86400000)
    : 30;
  const deadlineScore = 1 / (1 + daysLeft);
  const workload = (Number(a.estimated_hours) || 1) / 20;
  const prio = a.priority === "High" ? 1 : a.priority === "Medium" ? 0.5 : 0.2;
  return deadlineScore * 2 + workload + prio;
}

function Dashboard() {
  const query = useQuery({
    queryKey: ["assignments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const assignments = query.data ?? [];
  const active = assignments.filter((a) => a.status !== "done" && a.status !== "completed" as unknown as string || true);
  const recommended = [...active].sort((a, b) => scoreAssignment(b) - scoreAssignment(a))[0];
  const upcoming = [...active]
    .filter((a) => a.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);
  const recent = assignments.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your copilot</h1>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New assignment <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Today's recommendation
        </div>

        {query.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : !recommended ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              No assignments yet. Upload one and your copilot will suggest the best next step.
            </p>
            <Link
              to="/upload"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Upload assignment <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <Link to="/assignments/$id" params={{ id: recommended.id }} className="mt-4 block">
            <div className="flex flex-wrap items-center gap-2">
              {recommended.subject && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {recommended.subject}
                </span>
              )}
              {recommended.priority && (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary">
                  {recommended.priority} priority
                </span>
              )}
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight">{recommended.title}</p>
            {recommended.reasoning && (
              <p className="mt-2 text-sm text-muted-foreground">{recommended.reasoning}</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat icon={Clock} label="Focus time" value={recommended.estimated_hours ? `${recommended.estimated_hours}h` : "—"} />
              <Stat icon={Target} label="Deadline" value={recommended.deadline ? new Date(recommended.deadline).toLocaleDateString() : "—"} />
              <Stat icon={Zap} label="Confidence" value={recommended.confidence != null ? `${Math.round(Number(recommended.confidence) * 100)}%` : "—"} />
            </div>
          </Link>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ListCard title="Upcoming" items={upcoming} emptyLabel="No upcoming deadlines" showDeadline />
        <ListCard title="Recent uploads" items={recent} emptyLabel="No recent uploads" />
      </div>
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
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  emptyLabel,
  showDeadline,
}: {
  title: string;
  items: Assignment[];
  emptyLabel: string;
  showDeadline?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" /> {emptyLabel}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                to="/assignments/$id"
                params={{ id: a.id }}
                className="flex items-center justify-between gap-3 py-3 text-sm transition hover:text-primary"
              >
                <span className="truncate">{a.title}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {showDeadline && a.deadline
                    ? new Date(a.deadline).toLocaleDateString()
                    : `${a.estimated_hours ?? "?"}h`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
