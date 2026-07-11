import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setArchive, deleteAssignment } from "@/lib/assignments.functions";
import { Clock, FileText, Plus, Archive, Trash2, ArchiveRestore, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/assignments/")({
  head: () => ({ meta: [{ title: "Assignments — Academic Compass" }] }),
  component: AssignmentsIndex,
});

function priorityTone(p: string | null) {
  if (p === "High") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
  if (p === "Medium") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
}

function AssignmentsIndex() {
  const [tab, setTab] = useState<"active" | "completed" | "archived">("active");
  const qc = useQueryClient();
  const archiveFn = useServerFn(setArchive);
  const deleteFn = useServerFn(deleteAssignment);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["assignments-list", tab],
    queryFn: async () => {
      let q = supabase.from("assignments").select("*").order("created_at", { ascending: false });
      if (tab === "archived") {
        q = q.not("archived_at", "is", null);
      } else {
        q = q.is("archived_at", null);
        q = tab === "completed" ? q.eq("status", "completed") : q.neq("status", "completed");
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onArchive(id: string, archived: boolean) {
    try {
      await archiveFn({ data: { id, archived } });
      toast.success(archived ? "Archived" : "Restored");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
          <p className="mt-2 text-muted-foreground">Everything Compass is tracking.</p>
        </div>
        <Link to="/upload" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1 text-xs">
        {(["active", "archived"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 capitalize transition ${tab === t ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No assignments yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {query.data!.map((a) => (
              <div key={a.id} className="group relative rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
                <div className="absolute right-3 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to="/assignments/$id" params={{ id: a.id }}>Open</Link>
                      </DropdownMenuItem>
                      {a.archived_at ? (
                        <DropdownMenuItem onClick={() => onArchive(a.id, false)}>
                          <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onArchive(a.id, true)}>
                          <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setConfirmDelete(a.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link to="/assignments/$id" params={{ id: a.id }} className="block">
                  <div className="flex flex-wrap items-center gap-2 pr-8">
                    {a.subject && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{a.subject}</span>}
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${priorityTone(a.priority)}`}>{a.priority ?? "—"}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium">{a.title}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{a.estimated_hours ? `${a.estimated_hours}h` : "—"}</span>
                    <span>{a.deadline ? `Due ${new Date(a.deadline).toLocaleDateString()}` : "No deadline"}</span>
                  </div>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Number(a.progress ?? 0))}%` }} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the assignment, its roadmap, and all AI logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && onDelete(confirmDelete)} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
