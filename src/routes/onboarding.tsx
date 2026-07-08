import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Academic Copilot" },
      { name: "description", content: "Tell your copilot about your studies to personalize your roadmap." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Step 1 of 3
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Let's set up your copilot
        </h1>
        <p className="mt-2 text-muted-foreground">
          A few quick questions so we can tailor recommendations to your workload.
        </p>

        <div className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-8">
          <Field label="What are you studying?" placeholder="e.g. Computer Science" />
          <Field label="Current academic year" placeholder="e.g. Sophomore" />
          <Field label="Hours you can study per day" placeholder="e.g. 3" />
        </div>

        <div className="mt-8 flex justify-end">
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        placeholder={placeholder}
        disabled
        className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
