import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  ImageIcon,
  Type,
  Upload as UploadIcon,
  X,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { extractAssignment, saveAssignment, type AiAnalysis } from "@/lib/assignments.functions";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { useQuery } from "@tanstack/react-query";
import { analytics } from "@/lib/analytics";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({ meta: [{ title: "Upload assignment — Academic Compass" }] }),
  component: UploadPage,
});

type Mode = "pdf" | "image" | "text";
const MAX_BYTES = 20 * 1024 * 1024;

const ACCEPT: Record<Mode, string> = {
  pdf: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  image: ".png,.jpg,.jpeg,image/png,image/jpeg",
  text: ".txt,text/plain",
};

type Step = "upload" | "review";

function useSubjects() {
  return useQuery({
    queryKey: ["profile-subjects"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as string[];
      const { data } = await supabase.from("profiles").select("subjects").eq("id", u.user.id).maybeSingle();
      return (data?.subjects ?? []) as string[];
    },
  });
}

function UploadPage() {
  const navigate = useNavigate();
  const extract = useServerFn(extractAssignment);
  const save = useServerFn(saveAssignment);
  const subjects = useSubjects();

  const [step, setStep] = useState<Step>("upload");

  const [mode, setMode] = useState<Mode>("text");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [minWaitDone, setMinWaitDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review state
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [selectedDeadline, setSelectedDeadline] = useState<string>("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!subject && (subjects.data?.length ?? 0) > 0) setSubject(subjects.data![0]);
  }, [subjects.data, subject]);

  const uploadDisabled = useMemo(() => {
    if (processing) return true;
    if (mode === "text") return !text.trim() && !title.trim();
    if (!file) return true;
    return !title.trim();
  }, [processing, mode, file, text, title]);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("File is larger than 20 MB");
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function onExtract(e: React.FormEvent) {
    e.preventDefault();
    if (uploadDisabled) return;
    setProcessing(true);
    setMinWaitDone(false);
    const startTs = Date.now();
    analytics.aiAnalysisStarted({
      subject: subject || null,
      upload_method: mode,
      file_type: file?.type ?? null,
    });
    const minWait = new Promise<void>((resolve) =>
      setTimeout(() => {
        setMinWaitDone(true);
        resolve();
      }, 3200),
    );

    try {
      let file_url: string | null = null;
      let source_text: string | null = null;

      if (mode === "text") {
        source_text = text.trim();
      } else if (file) {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("assignments")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        file_url = path;
        if (file.type.startsWith("text/") || file.name.endsWith(".txt")) source_text = await file.text();
      }

      setUploadedFileUrl(file_url);

      const result = await extract({
        data: {
          title: title.trim(),
          subject: subject || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          notes: notes.trim() || null,
          source_type: mode === "text" ? "text" : mode === "image" ? "image" : "pdf",
          source_text,
          file_url,
          file_name: file?.name ?? null,
        },
      });

      await minWait;

      const a = result.analysis;
      setAnalysis(a);
      const initialDeadline = deadline || a.deadline_candidates[0] || "";
      setSelectedDeadline(initialDeadline ? toLocalDatetime(initialDeadline) : "");
      if (!subject && a.detected_subject) setSubject(a.detected_subject);
      analytics.aiAnalysisCompleted({
        subject: subject || a.detected_subject || null,
        processing_time: Date.now() - startTs,
        success: true,
      });
      setStep("review");
      setProcessing(false);
      toast.success("Compass has your first read");
    } catch (err) {
      console.error(err);
      analytics.aiAnalysisFailed({
        subject: subject || null,
        processing_time: Date.now() - startTs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setProcessing(false);
    }
  }

  async function onSave() {
    if (!analysis) return;
    if (!analysis.title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const result = await save({
        data: {
          title: analysis.title.trim(),
          subject: subject || null,
          deadline: selectedDeadline ? new Date(selectedDeadline).toISOString() : null,
          description: analysis.summary,
          notes: notes.trim() || null,
          priority: analysis.priority,
          difficulty: analysis.difficulty,
          estimated_hours: analysis.estimated_hours,
          tags: analysis.tags,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          summary: analysis.summary,
          deliverables: analysis.deliverables,
          skills_required: analysis.skills_required,
          source_type: mode === "text" ? "text" : mode === "image" ? "image" : "pdf",
          source_text: mode === "text" ? text.trim() : null,
          file_url: uploadedFileUrl,
          milestones: analysis.milestones,
        },
      });
      analytics.assignmentUploaded({
        assignment_id: result.id,
        subject: subject || null,
        assignment_type: analysis.difficulty ?? null,
        due_date: selectedDeadline ? new Date(selectedDeadline).toISOString() : null,
        upload_method: mode,
        file_type: mode === "text" ? "text" : (uploadedFileUrl ? mode : null),
      });
      if ((analysis.milestones?.length ?? 0) > 0) {
        analytics.roadmapGenerated({
          assignment_id: result.id,
          subject: subject || null,
          estimated_study_days: analysis.estimated_hours
            ? Math.ceil(analysis.estimated_hours / 3)
            : null,
          total_tasks_generated: analysis.milestones.length,
        });
      }
      toast.success("Saved and roadmap generated");
      navigate({ to: "/assignments/$id", params: { id: result.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (step === "review" && analysis) {
    return (
      <ReviewStep
        analysis={analysis}
        setAnalysis={setAnalysis}
        selectedDeadline={selectedDeadline}
        setSelectedDeadline={setSelectedDeadline}
        subject={subject}
        setSubject={setSubject}
        subjectOptions={subjects.data ?? []}
        notes={notes}
        setNotes={setNotes}
        tagInput={tagInput}
        setTagInput={setTagInput}
        onBack={() => setStep("upload")}
        onSave={onSave}
        saving={saving}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {processing && <ProcessingOverlay done={minWaitDone} />}
      <Stepper current={1} />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">New assignment</h1>
      <p className="mt-2 text-muted-foreground">
        Compass will read it, extract what matters, and let you review before saving.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <ModeCard icon={FileText} title="Upload PDF" description="PDF or DOCX up to 20 MB" active={mode === "pdf"} onClick={() => setMode("pdf")} />
        <ModeCard icon={ImageIcon} title="Upload image" description="JPG or PNG up to 20 MB" active={mode === "image"} onClick={() => setMode("image")} />
        <ModeCard icon={Type} title="Paste text" description="Directly paste the brief" active={mode === "text"} onClick={() => setMode("text")} />
      </div>

      <form onSubmit={onExtract} className="mt-8 space-y-6">
        {mode !== "text" ? (
          <div>
            <Label>File</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="mt-2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center transition hover:border-primary/40"
            >
              {file ? (
                <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="max-w-xs truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button type="button" onClick={() => setFile(null)} className="ml-1 rounded p-0.5 hover:bg-background">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <UploadIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Drag & drop your {mode === "image" ? "image" : "document"}</p>
                  <p className="text-xs text-muted-foreground">or</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept={ACCEPT[mode]} className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              {!file && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium hover:bg-secondary">
                  Choose file
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <Label>Assignment text</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste the assignment brief here…"
              className="mt-2 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Title" value={title} onChange={setTitle} placeholder="e.g. Database ER Diagram" />
          <div>
            <Label>Subject</Label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30">
              <option value="">Select a subject…</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Deadline (optional)</Label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30" />
          </div>
          <TextField label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Anything Compass should know" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={uploadDisabled} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            Analyze with Compass <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function toLocalDatetime(iso: string): string {
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  const labels = ["Upload", "AI Extraction", "Review", "Save & generate"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={l} className="flex flex-1 items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            <span className={`hidden text-xs sm:inline ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border bg-card hover:border-primary/30 hover:bg-secondary/50"}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{children}</label>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30" />
    </div>
  );
}

function ReviewStep({
  analysis,
  setAnalysis,
  selectedDeadline,
  setSelectedDeadline,
  subject,
  setSubject,
  subjectOptions,
  notes,
  setNotes,
  tagInput,
  setTagInput,
  onBack,
  onSave,
  saving,
}: {
  analysis: AiAnalysis;
  setAnalysis: (a: AiAnalysis) => void;
  selectedDeadline: string;
  setSelectedDeadline: (v: string) => void;
  subject: string;
  setSubject: (v: string) => void;
  subjectOptions: string[];
  notes: string;
  setNotes: (v: string) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof AiAnalysis>(k: K, v: AiAnalysis[K]) => setAnalysis({ ...analysis, [k]: v });
  const missingTitle = !analysis.title.trim();
  const noDeadline = !selectedDeadline;

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!analysis.tags.includes(t)) update("tags", [...analysis.tags, t]);
    setTagInput("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Stepper current={3} />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> Compass read your assignment
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Review before saving</h1>
          <p className="mt-2 text-muted-foreground">Tweak anything that's off. Compass will generate your roadmap when you save.</p>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <div>
          <Label>Assignment title *</Label>
          <input value={analysis.title} onChange={(e) => update("title", e.target.value)} className={`mt-2 w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 ${missingTitle ? "border-destructive" : "border-border focus:border-primary/40"}`} />
          {missingTitle && <p className="mt-1 text-xs text-destructive">Title is required</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Subject</Label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30">
              <option value="">Select a subject…</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Deadline {noDeadline && <span className="text-destructive">— none detected</span>}</Label>
            <input type="datetime-local" value={selectedDeadline} onChange={(e) => setSelectedDeadline(e.target.value)} className={`mt-2 w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 ${noDeadline ? "border-destructive/60" : "border-border focus:border-primary/40"}`} />
            {analysis.deadline_candidates.length > 1 && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium">I found multiple possible deadlines.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.deadline_candidates.map((c) => (
                    <button key={c} type="button" onClick={() => setSelectedDeadline(toLocalDatetime(c))} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-100">
                      {new Date(c).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Priority</Label>
            <select value={analysis.priority} onChange={(e) => update("priority", e.target.value as AiAnalysis["priority"])} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
              {(["Low", "Medium", "High"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <select value={analysis.difficulty} onChange={(e) => update("difficulty", e.target.value as AiAnalysis["difficulty"])} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
              {(["Easy", "Medium", "Hard"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label>Estimated hours</Label>
            <input type="number" min={0.5} step={0.5} value={analysis.estimated_hours} onChange={(e) => update("estimated_hours", Number(e.target.value))} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Notes</Label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Personal notes" className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <textarea value={analysis.summary} onChange={(e) => update("summary", e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30" />
        </div>

        <div>
          <Label>Tags</Label>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {analysis.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs">
                {t}
                <button type="button" onClick={() => update("tags", analysis.tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Add tag…" className="rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs outline-none focus:border-primary" />
          </div>
        </div>

        {analysis.reasoning && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Why Compass thinks this</p>
            <p className="mt-2 text-sm text-muted-foreground">{analysis.reasoning}</p>
          </div>
        )}

        {analysis.milestones.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Planned roadmap</p>
            <ol className="mt-3 space-y-2 text-sm">
              {analysis.milestones.map((m, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{m.estimated_time}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={onBack} className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-secondary">Back</button>
          <button type="button" disabled={saving || missingTitle} onClick={onSave} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            Save & generate roadmap <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
