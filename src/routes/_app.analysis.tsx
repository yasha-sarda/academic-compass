import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Brain, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/analysis")({
  head: () => ({ meta: [{ title: "AI Analysis — Academic Copilot" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const query = useQuery({
    queryKey: ["assignments-analysis-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, subject, summary, difficulty, priority, estimated_hours, confidence, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight">AI Analysis</h1>
      <p className="mt-2 text-muted-foreground">
        Every assignment your copilot has broken down.
      </p>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium">No analysis yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload an assignment to generate your first breakdown.
            </p>
            <Link
              to="/upload"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Upload <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {query.data!.map((a) => (
              <li key={a.id}>
                <Link
                  to="/assignments/$id"
                  params={{ id: a.id }}
                  className="block rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.subject && <span className="rounded-full bg-secondary px-2 py-0.5">{a.subject}</span>}
                    {a.difficulty && <span>{a.difficulty}</span>}
                    {a.priority && <span>· {a.priority} priority</span>}
                    {a.estimated_hours != null && <span>· {a.estimated_hours}h</span>}
                    {a.confidence != null && <span>· {Math.round(Number(a.confidence) * 100)}% confidence</span>}
                  </div>
                  <p className="mt-2 text-sm font-medium">{a.title}</p>
                  {a.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
