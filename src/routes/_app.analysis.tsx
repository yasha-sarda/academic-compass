import { createFileRoute } from "@tanstack/react-router";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/_app/analysis")({
  head: () => ({ meta: [{ title: "AI Analysis — Academic Copilot" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">AI Analysis</h1>
      <p className="mt-2 text-muted-foreground">
        Live breakdown of scope, complexity, and estimated hours.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-4 text-sm font-medium">No analysis yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an assignment to generate your first breakdown.
        </p>
      </div>
    </div>
  );
}
