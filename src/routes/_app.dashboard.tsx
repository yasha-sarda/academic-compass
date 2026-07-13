import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowUpRight,
  Clock,
  FileText,
  Compass,
  Target,
  Zap,
  Map as MapIcon,
  Upload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { analytics } from "@/lib/analytics";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Academic Compass" }] }),
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
  status: string;
  progress: number;
  archived_at: string | null;
  created_at: string;
};

function scoreAssignment(a: Assignment): number {
  const now = Date.now();
  const daysLeft = a.deadline ? Math.max(0, (new Date(a.deadline).getTime() - now) / 86400000) : 30;
  const deadlineScore = 1 / (1 + daysLeft);
  const workload = (Number(a.estimated_hours) || 1) / 20;
  const prio = a.priority === "High" ? 1 : a.priority === "Medium" ? 0.5 : 0.2;
  const remaining = (100 - Number(a.progress ?? 0)) / 100;
  return deadlineScore * 2 + workload + prio + remaining;
}

function buildReason(a: Assignment): string {
  const parts: string[] = [];
  if (a.deadline) {
    const days = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);
    if (days <= 0) parts.push("it's due today");
    else if (days <= 3) parts.push(`it's due in ${days} day${days === 1 ? "" : "s"}`);
    else parts.push(`the deadline is ${days} days out`);
  }
  if (a.priority === "High") parts.push("marked high priority");
  if ((a.estimated_hours ?? 0) >= 6) parts.push(`a ${a.estimated_hours}h workload remains`);
  if ((a.progress ?? 0) > 0 && (a.progress ?? 0) < 100) parts.push(`you're ${a.progress}% through`);
  if (parts.length === 0) parts.push("it's the freshest task waiting on you");
  return `Compass picked this because ${parts.join(", ")}.`;
}

function Dashboard() {
  useEffect(() => {
    analytics.dashboardViewed();
  }, []);

  const query = useQuery({
    queryKey: ["assignments-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const roadmapsQuery = useQuery({
    queryKey: ["roadmaps-with-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmaps")
        .select("id, step, completed, assignment_id, assignments!inner(title, archived_at)")
        .order("order_index");
      if (error) throw error;
      return (data ?? []).filter((r) => !(r.assignments as unknown as { archived_at: string | null }).archived_at);
    },
  });

  const assignments = (query.data ?? []).filter((a) => a.status !== "completed");
  const recommended = [...assignments]
    .sort((a, b) => scoreAssignment(b) - scoreAssignment(a))[0];
  const upcoming = [...assignments]
    .filter((a) => a.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);
  const inProgress = assignments.filter((a) => (a.progress ?? 0) > 0 && (a.progress ?? 0) < 100).slice(0, 5);
  const recent = assignments.slice(0, 5);

  const roadmapGroups = new Map<string, { title: string; total: number; done: number }>();
  for (const r of roadmapsQuery.data ?? []) {
    const key = r.assignment_id as string;
    const meta = (r.assignments as unknown as { title: string }).title;
    const cur = roadmapGroups.get(key) ?? { title: meta, total: 0, done: 0 };
    cur.total += 1;
    if (r.completed) cur.done += 1;
    roadmapGroups.set(key, cur);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back to Academic Compass</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">What should I do today?</h1>
        </div>
        <Link
          to="/upload"
          className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:inline-flex"
        >
          <Upload className="h-3.5 w-3.5" /> New assignment
        </Link>
      </div>

      {/* Hero recommendation */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Compass className="h-3.5 w-3.5 text-primary" /> Today's Recommendation
        </div>

        {query.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : !recommended ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-background/50 p-8 text-center">
            <p className="text-sm font-medium">Compass is ready when you are.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first assignment and Compass will tell you exactly what deserves your attention today.
            </p>
            <Link
              to="/upload"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Upload assignment <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {recommended.subject && (
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {recommended.subject}
                </span>
              )}
              {recommended.priority && (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary">
                  {recommended.priority} priority
                </span>
              )}
            </div>
            <Link to="/assignments/$id" params={{ id: recommended.id }} className="mt-3 block">
              <p className="text-2xl font-semibold tracking-tight hover:text-primary">
                {recommended.title}
              </p>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">{buildReason(recommended)}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat icon={Clock} label="Recommended focus" value={recommended.estimated_hours ? `${Math.min(2, recommended.estimated_hours)}h block` : "—"} />
              <Stat icon={Target} label="Deadline" value={recommended.deadline ? new Date(recommended.deadline).toLocaleDateString() : "None"} />
              <Stat icon={Zap} label="Confidence" value={recommended.confidence != null ? `${Math.round(Number(recommended.confidence) * 100)}%` : "—"} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                to="/assignments/$id"
                params={{ id: recommended.id }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Start working <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/roadmaps"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                View roadmap
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ListCard title="Upcoming deadlines" items={upcoming} emptyLabel="No upcoming deadlines" showDeadline />
        <ListCard title="In progress" items={inProgress} emptyLabel="Nothing in flight yet" />
        <ListCard title="Recent uploads" items={recent} emptyLabel="No recent uploads" />
        <RoadmapCard groups={Array.from(roadmapGroups.entries()).slice(0, 5)} />
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
    <div className="rounded-xl border border-border bg-background/60 p-3">
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

function RoadmapCard({ groups }: { groups: Array<[string, { title: string; total: number; done: number }]> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Roadmaps</p>
        <Link to="/roadmaps" className="text-xs text-primary hover:underline">All</Link>
      </div>
      {groups.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <MapIcon className="h-4 w-4" /> No roadmap generated yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {groups.map(([id, g]) => {
            const pct = Math.round((g.done / g.total) * 100);
            return (
              <li key={id}>
                <Link to="/assignments/$id" params={{ id }} className="block">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.title}</span>
                    <span className="text-xs text-muted-foreground">{g.done}/{g.total}</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
