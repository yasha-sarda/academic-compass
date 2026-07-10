import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Academic Compass" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const query = useQuery({
    queryKey: ["profile-full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const p = query.data?.profile;
  const u = query.data?.user;
  const initial = (p?.full_name || u?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-muted-foreground">Your study preferences and account.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </div>
          <div>
            <p className="text-sm font-medium">{p?.full_name ?? "Student"}</p>
            <p className="text-xs text-muted-foreground">{u?.email ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Studies</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="University" value={p?.university} />
          <Row label="Semester" value={p?.semester} />
          <Row label="Daily study hours" value={p?.daily_study_hours ? `${p.daily_study_hours}h` : null} />
          <Row label="Preferred time" value={p?.preferred_study_time} />
        </dl>
        {p?.subjects && p.subjects.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Subjects</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.subjects.map((s: string) => <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{s}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value || "—"}</dd>
    </div>
  );
}
