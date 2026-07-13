import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  updateAssignment,
  setArchive,
  deleteAssignment,
  regenerateRoadmap,
  setAssignmentStatus,
} from "@/lib/assignments.functions";
import { createChat } from "@/lib/compass.functions";
import { analytics } from "@/lib/analytics";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Edit,
  Target,
  Zap,
  Map as MapIcon,
  Archive,
  Trash2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_app/assignments/$id")({
  head: () => ({ meta: [{ title: "Assignment — Academic Compass" }] }),
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const update = useServerFn(updateAssignment);
  const archive = useServerFn(setArchive);
  const del = useServerFn(deleteAssignment);
  const regen = useServerFn(regenerateRoadmap);
  const setStatus = useServerFn(setAssignmentStatus);
  const newChat = useServerFn(createChat);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const query = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.from("assignments").select("*").eq("id", id).maybeSingle(),
        supabase.from("roadmaps").select("*").eq("assignment_id", id).order("order_index"),
      ]);
      return { assignment: a, milestones: m ?? [] };
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const a = query.data?.assignment;
  if (!a) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/assignments" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline h-3.5 w-3.5" /> All assignments
        </Link>
        <p className="mt-8 text-sm text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }
  const milestones = query.data!.milestones;
  const deliverables = (a.deliverables ?? []) as string[];
  const skills = (a.skills_required ?? []) as string[];
  const tags = (a.tags ?? []) as string[];

  const isCompleted = a.status === "completed";
  const criticalFields: Array<keyof EditableAssignment> = ["deadline", "priority", "difficulty", "description"];

  async function askCompass() {
    try {
      const res = await newChat({ data: { assignment_id: id, title: `About: ${a!.title}` } });
      navigate({ to: "/compass/$chatId", params: { chatId: res.id }, search: {} });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start chat");
    }
  }

  async function onRegenerate() {
    setRegenLoading(true);
    try {
      await regen({ data: { id } });
      analytics.roadmapRegenerated({
        assignment_id: id,
        subject: a?.subject ?? null,
      });
      toast.success("Roadmap regenerated");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRegenLoading(false);
      setConfirmRegen(false);
    }
  }

  async function toggleCompleted() {
    try {
      await setStatus({ data: { id, status: isCompleted ? "in_progress" : "completed" } });
      if (!isCompleted) {
        analytics.assignmentMarkedComplete({
          assignment_id: id,
          subject: a?.subject ?? null,
        });
      }
      toast.success(isCompleted ? "Moved to active" : "Marked completed");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All assignments
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_240px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {a.subject && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{a.subject}</span>}
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{a.priority ?? "—"} priority</span>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{a.difficulty ?? "—"}</span>
            {a.archived_at && <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Archived</span>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{a.title}</h1>
          {a.summary && <p className="mt-3 text-muted-foreground">{a.summary}</p>}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat icon={Clock} label="Estimated" value={a.estimated_hours ? `${a.estimated_hours}h` : "—"} />
            <Stat icon={Target} label="Deadline" value={a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"} />
            <Stat icon={Zap} label="Confidence" value={a.confidence != null ? `${Math.round(Number(a.confidence) * 100)}%` : "—"} />
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Progress</span>
              <span>{a.progress ?? 0}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${a.progress ?? 0}%` }} />
            </div>
          </div>

          {a.reasoning && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <Brain className="h-3.5 w-3.5 text-primary" /> Compass reasoning
              </div>
              <p className="mt-3 text-sm">{a.reasoning}</p>
            </section>
          )}

          {(deliverables.length > 0 || skills.length > 0 || tags.length > 0) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {deliverables.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Deliverables</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {deliverables.map((d) => <li key={d} className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 rounded-full bg-primary" /> {d}</li>)}
                  </ul>
                </section>
              )}
              {skills.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Skills</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {skills.map((s) => <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{s}</span>)}
                  </div>
                </section>
              )}
              {tags.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-6 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tags</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => <span key={t} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">#{t}</span>)}
                  </div>
                </section>
              )}
            </div>
          )}

          {milestones.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <MapIcon className="h-3.5 w-3.5 text-primary" /> Roadmap preview
                </div>
                <Link to="/roadmaps" className="text-xs text-primary hover:underline">Open in Roadmaps</Link>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                {milestones.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className={m.completed ? "line-through text-muted-foreground" : "font-medium"}>{m.step}</p>
                      {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{m.estimated_time ?? "—"}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {a.notes && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Notes</p>
              <p className="mt-3 text-sm">{a.notes}</p>
            </section>
          )}
        </div>

        {/* Quick actions */}
        <aside className="space-y-2 lg:sticky lg:top-6 lg:h-fit">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Quick actions</p>
          <ActionButton
            icon={isCompleted ? RotateCcw : CheckCircle2}
            label={isCompleted ? "Move back to active" : "Mark as completed"}
            onClick={toggleCompleted}
            highlight={!isCompleted}
          />
          <ActionButton icon={Edit} label="Edit assignment" onClick={() => setEditing(true)} />
          <ActionButton icon={MapIcon} label="View roadmap" onClick={() => navigate({ to: "/roadmaps", search: { assignment: id } })} />
          <ActionButton icon={RefreshCw} label="Regenerate roadmap" onClick={() => setConfirmRegen(true)} />
          <ActionButton icon={MessageSquare} label="Ask Compass" onClick={askCompass} />
          <ActionButton icon={Archive} label={a.archived_at ? "Restore" : "Archive"} onClick={async () => {
            await archive({ data: { id, archived: !a.archived_at } });
            toast.success(a.archived_at ? "Restored" : "Archived");
            qc.invalidateQueries();
          }} />
          <ActionButton icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} destructive />
        </aside>
      </div>

      <EditDialog
        open={editing}
        onOpenChange={setEditing}
        assignment={a}
        onSave={async (patch) => {
          try {
            await update({ data: { id, ...patch } });
            analytics.assignmentEdited({
              assignment_id: id,
              subject: (patch.subject ?? a?.subject) ?? null,
              fields_changed: Object.keys(patch),
            });
            toast.success("Saved");
            qc.invalidateQueries();
            setEditing(false);
            // If a critical field changed, ask about regenerating the roadmap
            const changedCritical = criticalFields.some((k) => {
              const before = (a as unknown as Record<string, unknown>)[k];
              const after = (patch as unknown as Record<string, unknown>)[k];
              return after !== undefined && after !== before;
            });
            if (changedCritical && (query.data?.milestones.length ?? 0) > 0) {
              setConfirmRegen(true);
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This assignment has changed.</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like Compass to regenerate the roadmap? Existing milestones and progress will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep existing roadmap</AlertDialogCancel>
            <AlertDialogAction onClick={onRegenerate} disabled={regenLoading}>
              {regenLoading ? "Generating…" : "Generate new roadmap"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the assignment, its roadmap, and AI logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                await del({ data: { id } });
                analytics.assignmentDeleted({
                  assignment_id: id,
                  subject: a?.subject ?? null,
                });
                toast.success("Deleted");
                navigate({ to: "/assignments" });
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, highlight, destructive }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; highlight?: boolean; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
        highlight ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10" :
        destructive ? "border-border bg-card text-destructive hover:bg-destructive/5" :
        "border-border bg-card hover:bg-secondary"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

type EditableAssignment = {
  title: string;
  subject: string | null;
  deadline: string | null;
  description: string | null;
  notes: string | null;
  priority: string | null;
  difficulty: string | null;
  estimated_hours: number | null;
  tags: string[] | null;
};

function EditDialog({ open, onOpenChange, assignment, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: EditableAssignment;
  onSave: (patch: Partial<EditableAssignment>) => Promise<void>;
}) {
  const [title, setTitle] = useState(assignment.title);
  const [subject, setSubject] = useState(assignment.subject ?? "");
  const [deadline, setDeadline] = useState(assignment.deadline ? toLocal(assignment.deadline) : "");
  const [description, setDescription] = useState(assignment.description ?? "");
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [priority, setPriority] = useState(assignment.priority ?? "Medium");
  const [difficulty, setDifficulty] = useState(assignment.difficulty ?? "Medium");
  const [hours, setHours] = useState(String(assignment.estimated_hours ?? ""));
  const [tags, setTags] = useState<string[]>((assignment.tags ?? []) as string[]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit assignment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Row label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
            <Row label="Deadline"><input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
            <Row label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {["Low", "Medium", "High"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Row>
            <Row label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {["Easy", "Medium", "Hard"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Row>
            <Row label="Estimated hours"><input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
          </div>
          <Row label="Description"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
          <Row label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></Row>
          <Row label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {t}<button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground">×</button>
                </span>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); const t = tagInput.trim(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput(""); }
              }} placeholder="Add…" className="rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-xs outline-none" />
            </div>
          </Row>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-full border border-border bg-background px-4 py-2 text-sm">Cancel</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                title,
                subject: subject || null,
                deadline: deadline ? new Date(deadline).toISOString() : null,
                description: description || null,
                notes: notes || null,
                priority,
                difficulty,
                estimated_hours: hours ? Number(hours) : null,
                tags,
              });
              setSaving(false);
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >Save changes</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function toLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  } catch { return ""; }
}
