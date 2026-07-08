import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Academic Copilot" },
      { name: "description", content: "Sign in to your AI Academic Copilot account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mx-auto mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Academic Copilot</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your copilot.
          </p>

          <div className="mt-6 space-y-3">
            <input
              type="email"
              placeholder="you@university.edu"
              disabled
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              placeholder="Password"
              disabled
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Link
              to="/onboarding"
              className="block w-full rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Continue
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Placeholder — authentication not yet wired.
          </p>
        </div>
      </div>
    </div>
  );
}
