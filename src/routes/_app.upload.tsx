import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, ImageIcon, Type, Upload as UploadIcon, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { analyzeAndSaveAssignment } from "@/lib/assignments.functions";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({ meta: [{ title: "Upload assignment — Academic Copilot" }] }),
  component: UploadPage,
});

type Mode = "pdf" | "image" | "text";
const MAX_BYTES = 20 * 1024 * 1024;

const ACCEPT: Record<Mode, string> = {
  pdf: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  image: ".png,.jpg,.jpeg,image/png,image/jpeg",
  text: ".txt,text/plain",
};

function useSubjects() {
  return useQuery({
    queryKey: ["profile-subjects"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as string[];
      const { data } = await supabase
        .from("profiles")
        .select("subjects")
        .eq("id", u.user.id)
        .maybeSingle();
      return (data?.subjects ?? []) as string[];
    },
  });
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
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "border-border bg-card hover:border-primary/30 hover:bg-secondary/50"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function UploadPage() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeAndSaveAssignment);
  const subjects = useSubjects();

  const [mode, setMode] = useState<Mode>("text");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [minWaitDone, setMinWaitDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!subject && (subjects.data?.length ?? 0) > 0) setSubject(subjects.data![0]);
  }, [subjects.data, subject]);

  const disabled = useMemo(() => {
    if (submitting) return true;
    if (!title.trim() && mode === "text") return !text.trim();
    if (mode !== "text" && !file) return true;
    return !title.trim();
  }, [submitting, mode, file, text, title]);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("File is larger than 20 MB");
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setMinWaitDone(false);
    const minWait = new Promise<void>((resolve) => setTimeout(() => {
      setMinWaitDone(true);
      resolve();
    }, 3800));

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
        if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
          source_text = await file.text();
        }
      }

      const result = await analyze({
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
      toast.success("Assignment analyzed");
      navigate({ to: "/assignments/$id", params: { id: result.id } });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {submitting && <ProcessingOverlay done={minWaitDone && false} />}
      <h1 className="text-3xl font-semibold tracking-tight">New assignment</h1>
      <p className="mt-2 text-muted-foreground">
        Choose how you'd like to hand it to your copilot.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <ModeCard
          icon={FileText}
          title="Upload PDF"
          description="PDF or DOCX up to 20 MB"
          active={mode === "pdf"}
          onClick={() => setMode("pdf")}
        />
        <ModeCard
          icon={ImageIcon}
          title="Upload image"
          description="JPG or PNG up to 20 MB"
          active={mode === "image"}
          onClick={() => setMode("image")}
        />
        <ModeCard
          icon={Type}
          title="Paste text"
          description="Directly paste the brief"
          active={mode === "text"}
          onClick={() => setMode("text")}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {mode !== "text" ? (
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              File
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="mt-2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center"
            >
              {file ? (
                <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="max-w-xs truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-1 rounded p-0.5 hover:bg-background"
                  >
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
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT[mode]}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {!file && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  Choose file
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Assignment text
            </label>
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
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database ER Diagram"
              className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            >
              <option value="">Select a subject…</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the copilot should know"
              className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Analyze with AI <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
