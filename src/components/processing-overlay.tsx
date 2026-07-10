import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

const STEPS = [
  "Reading assignment",
  "Understanding requirements",
  "Estimating workload",
  "Identifying deliverables",
  "Calculating priority",
  "Generating roadmap",
];

export function ProcessingOverlay({ done }: { done: boolean }) {
  const [visibleStep, setVisibleStep] = useState(0);

  useEffect(() => {
    if (done) {
      setVisibleStep(STEPS.length);
      return;
    }
    const interval = setInterval(() => {
      setVisibleStep((s) => Math.min(STEPS.length - 1, s + 1));
    }, 650);
    return () => clearInterval(interval);
  }, [done]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Compass
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">Analyzing your assignment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This usually takes a few seconds.
        </p>

        <ul className="mt-6 space-y-3">
          {STEPS.map((step, i) => {
            const complete = i < visibleStep || done;
            const active = i === visibleStep && !done;
            return (
              <li
                key={step}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  i <= visibleStep || done ? "opacity-100" : "opacity-30"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    complete
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {complete ? (
                    <Check className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                </span>
                <span className={complete ? "text-foreground" : "text-muted-foreground"}>{step}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
