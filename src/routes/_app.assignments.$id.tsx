import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/assignments/$id")({
  head: () => ({ meta: [{ title: "Assignment — Academic Copilot" }] }),
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/assignments" className="text-sm text-muted-foreground hover:text-foreground">
        ← All assignments
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Assignment #{id}</h1>
      <p className="mt-2 text-muted-foreground">
        Scope, requirements, deliverables, and the copilot's take will live here.
      </p>

      <div className="mt-8 space-y-4">
        <Section title="Overview">Placeholder for the assignment summary.</Section>
        <Section title="Estimated effort">Placeholder for effort breakdown.</Section>
        <Section title="Recommended next step">Placeholder for AI recommendation.</Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <p className="mt-3 text-sm">{children}</p>
    </div>
  );
}
