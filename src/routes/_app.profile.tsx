import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, Check } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Academic Compass" }] }),
  component: ProfilePage,
});

type StudyTime = "morning" | "afternoon" | "evening" | "night";

function ProfilePage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["profile-full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  const [fullName, setFullName] = useState("");
  const [college, setCollege] = useState("");
  const [course, setCourse] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [dailyGoal, setDailyGoal] = useState("");
  const [studyTime, setStudyTime] = useState<StudyTime | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = query.data?.profile;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setCollege((p.college as string | null) ?? p.university ?? "");
    setCourse((p.course as string | null) ?? "");
    setBranch((p.branch as string | null) ?? "");
    setSemester(p.semester ?? "");
    setSubjects(p.subjects ?? []);
    setDailyGoal(p.daily_study_hours ? String(p.daily_study_hours) : "");
    setStudyTime((p.preferred_study_time as StudyTime) ?? "");
  }, [query.data?.profile]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const u = query.data?.user;
  const initial = (fullName || u?.email || "?").charAt(0).toUpperCase();

  function addSubject() {
    const v = subjectInput.trim();
    if (!v || subjects.includes(v)) {
      setSubjectInput("");
      return;
    }
    setSubjects([...subjects, v]);
    setSubjectInput("");
  }

  async function onSave() {
    if (!u) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          university: college.trim() || null,
          college: college.trim() || null,
          course: course.trim() || null,
          branch: branch.trim() || null,
          semester: semester.trim() || null,
          subjects,
          daily_study_hours: dailyGoal ? Number(dailyGoal) : null,
          preferred_study_time: studyTime || null,
        })
        .eq("id", u.id);
      if (error) throw error;
      toast.success("Profile updated");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-muted-foreground">Compass uses this to personalize every recommendation.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </div>
          <div>
            <p className="text-sm font-medium">{fullName || "Student"}</p>
            <p className="text-xs text-muted-foreground">{u?.email ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-6 rounded-2xl border border-border bg-card p-6">
        <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Ada Lovelace" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="College / University" value={college} onChange={setCollege} placeholder="e.g. MIT" />
          <Field label="Course" value={course} onChange={setCourse} placeholder="e.g. B.Tech" />
          <Field label="Branch" value={branch} onChange={setBranch} placeholder="e.g. Computer Science" />
          <Field label="Semester" value={semester} onChange={setSemester} placeholder="e.g. Fall 2026" />
        </div>

        <div>
          <Label>Subjects</Label>
          <div className="mt-2 flex gap-2">
            <input
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubject();
                }
              }}
              placeholder="Add a subject"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={addSubject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/80"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {subjects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs">
                  {s}
                  <button onClick={() => setSubjects(subjects.filter((x) => x !== s))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Daily study goal (hours)</Label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              placeholder="e.g. 3"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <Label>Preferred study time</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["morning", "afternoon", "evening", "night"] as StudyTime[]).map((t) => {
                const active = studyTime === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStudyTime(t)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs capitalize transition ${
                      active ? "border-primary bg-primary/5 font-medium text-primary" : "border-input bg-background hover:bg-secondary"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{children}</label>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
