import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles, Clock, Target } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Academic Copilot" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good afternoon</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your copilot</h1>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          New assignment <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Next best step
        </div>
        <p className="mt-3 text-lg font-medium">
          Your workspace is empty. Upload an assignment to see recommendations here.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card icon={Clock} label="Estimated workload" value="—" />
        <Card icon={Target} label="Active roadmaps" value="0" />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
