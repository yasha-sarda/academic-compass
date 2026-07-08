import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Academic Copilot" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-muted-foreground">Your study preferences and account.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            S
          </div>
          <div>
            <p className="text-sm font-medium">Student</p>
            <p className="text-xs text-muted-foreground">you@university.edu</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Preferences
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Placeholder — settings will appear here.
        </p>
      </div>
    </div>
  );
}
