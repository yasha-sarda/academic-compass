import { createFileRoute } from "@tanstack/react-router";
import { useTheme, type Theme } from "@/lib/theme";
import { Monitor, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Academic Compass" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const opts: Array<{ v: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { v: "system", label: "System", icon: Monitor },
    { v: "light", label: "Light", icon: Sun },
    { v: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">Personalize how Academic Compass looks and behaves.</p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Appearance</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {opts.map(({ v, label, icon: Icon }) => {
            const active = theme === v;
            return (
              <button key={v} onClick={() => setTheme(v)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition ${active ? "border-primary bg-primary/5 text-primary" : "border-border bg-background hover:bg-secondary"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
