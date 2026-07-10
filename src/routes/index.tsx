import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Academic Compass</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/auth" className="text-muted-foreground transition hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-24 pb-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Your AI-first academic operating system
        </div>
        <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-6xl">
          Stop guessing.
          <br />
          <span className="text-muted-foreground">Know your next best step.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Academic Compass analyzes your assignments, estimates real effort, and — through Compass, your AI companion — tells you exactly what to work on right now, and why.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
