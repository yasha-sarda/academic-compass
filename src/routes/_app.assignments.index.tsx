import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/assignments/")({
  head: () => ({ meta: [{ title: "Assignments — Academic Copilot" }] }),
  component: AssignmentsIndex,
});

function priorityTone(p: string | null) {
  if (p === "High") return "bg-red-50 text-red-700 border-red-200";
  if (p === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function AssignmentsIndex() {
  const query = useQuery({
    queryKey: ["assignments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
          <p className="mt-2 text-muted-foreground">Everything your copilot is tracking.</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {query.data!.map((a) => (
              <Link
                key={a.id}
                to="/assignments/$id"
                params={{ id: a.id }}
                className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  {a.subject && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {a.subject}
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${priorityTone(a.priority)}`}>
                    {a.priority ?? "—"}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium">{a.title}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.estimated_hours ? `${a.estimated_hours}h` : "—"}
                  </span>
                  <span>
                    {a.deadline
                      ? `Due ${new Date(a.deadline).toLocaleDateString()}`
                      : "No deadline"}
                  </span>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Number(a.progress ?? 0))}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
