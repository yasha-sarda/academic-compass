import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";

export const Route = createFileRoute("/_app/roadmap")({
  head: () => ({ meta: [{ title: "Roadmap — Academic Copilot" }] }),
  component: RoadmapPage,
});

function RoadmapPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Study roadmap</h1>
      <p className="mt-2 text-muted-foreground">
        A day-by-day plan generated from your active assignments.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Map className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-4 text-sm font-medium">Your roadmap will appear here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add an assignment and we'll sequence the work for you.
        </p>
      </div>
    </div>
  );
}
