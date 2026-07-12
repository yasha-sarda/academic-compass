import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Plus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.onboarding_completed) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Onboarding — Academic Compass" },
      {
        name: "description",
        content: "Tell your Compass about your studies to personalize your roadmap.",
      },
    ],
  }),
  component: OnboardingPage,
});

type StudyTime = "morning" | "afternoon" | "evening" | "night";

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [semester, setSemester] = useState("");

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState("");

  const [dailyHours, setDailyHours] = useState("");
  const [studyTime, setStudyTime] = useState<StudyTime | "">("");

  function addSubject() {
    const val = subjectInput.trim();
    if (!val) return;
    if (subjects.includes(val)) {
      setSubjectInput("");
      return;
    }
    setSubjects([...subjects, val]);
    setSubjectInput("");
  }

  const canNextStep1 = fullName.trim() && university.trim() && semester.trim();
  const canNextStep2 = subjects.length > 0;
  const canFinish = dailyHours && Number(dailyHours) > 0 && studyTime;

  async function handleFinish() {
    if (!canFinish) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          university: university.trim(),
          semester: semester.trim(),
          subjects,
          daily_study_hours: Number(dailyHours),
          preferred_study_time: studyTime,
          onboarding_completed: true,
        })
        .eq("id", userData.user.id);
      if (error) throw error;
      toast.success("You're all set!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition ${
                step >= n ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Step {step} of 3
        </p>

        {step === 1 && (
          <>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Welcome to Academic Compass
            </h1>
            <p className="mt-2 text-muted-foreground">
              Let's get to know you so recommendations feel personal.
            </p>

            <div className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-8">
              <Field
                label="Full name"
                value={fullName}
                onChange={setFullName}
                placeholder="Ada Lovelace"
              />
              <Field
                label="University"
                value={university}
                onChange={setUniversity}
                placeholder="e.g. MIT"
              />
              <Field
                label="Semester"
                value={semester}
                onChange={setSemester}
                placeholder="e.g. Fall 2026"
              />
            </div>

            <NavButtons
              onNext={() => setStep(2)}
              nextDisabled={!canNextStep1}
              nextLabel="Continue"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Add your subjects</h1>
            <p className="mt-2 text-muted-foreground">
              Add every course you're taking this semester.
            </p>

            <div className="mt-10 rounded-2xl border border-border bg-card p-8">
              <label className="text-sm font-medium">Subject</label>
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
                  placeholder="e.g. Linear Algebra"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={addSubject}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium transition hover:bg-secondary/80"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>

              {subjects.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs"
                    >
                      {s}
                      <button
                        onClick={() => setSubjects(subjects.filter((x) => x !== s))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <NavButtons
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextDisabled={!canNextStep2}
              nextLabel="Continue"
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Study preferences</h1>
            <p className="mt-2 text-muted-foreground">
              We'll shape roadmaps around when and how much you study.
            </p>

            <div className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-8">
              <div>
                <label className="text-sm font-medium">Hours available per day</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  placeholder="e.g. 3"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Preferred study time</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["morning", "afternoon", "evening", "night"] as StudyTime[]).map((t) => {
                    const active = studyTime === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setStudyTime(t)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm capitalize transition ${
                          active
                            ? "border-primary bg-primary/5 font-medium text-primary"
                            : "border-input bg-background hover:bg-secondary"
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <NavButtons
              onBack={() => setStep(2)}
              onNext={handleFinish}
              nextDisabled={!canFinish || saving}
              nextLabel={saving ? "Saving…" : "Finish"}
              loading={saving}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  loading,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
  loading?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <button
          onClick={onBack}
          className="rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {nextLabel}
        {!loading && <ArrowRight className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
