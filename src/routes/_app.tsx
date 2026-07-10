import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Sparkles,
  LayoutDashboard,
  Upload,
  Brain,
  Map,
  User,
  FileText,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw redirect({ to: "/" });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.onboarding_completed) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AppShell,
});

type NavItem = {
  to: "/dashboard" | "/upload" | "/analysis" | "/assignments" | "/roadmap" | "/profile";
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/analysis", label: "AI Analysis", icon: Brain },
  { to: "/assignments", label: "Assignments", icon: FileText },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/profile", label: "Profile", icon: User },
];

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
          <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Copilot</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleSignOut}
            className="mt-4 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="min-h-screen flex-1 px-6 py-10 md:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
