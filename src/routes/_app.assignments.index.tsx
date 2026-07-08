import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_app/assignments/")({
  head: () => ({ meta: [{ title: "Assignments — Academic Copilot" }] }),
  component: AssignmentsIndex,
});

function AssignmentsIndex() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
      <p className="mt-2 text-muted-foreground">All assignments your copilot is tracking.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Upload one to get started.</p>
      </div>
    </div>
  );
}
