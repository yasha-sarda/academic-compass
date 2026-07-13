import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Compass,
  LayoutDashboard,
  Map,
  User,
  FileText,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analytics, resetAnalytics } from "@/lib/analytics";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
  },
  component: AppShell,
});

type NavItem = {
  to: "/dashboard" | "/assignments" | "/roadmaps" | "/compass" | "/profile" | "/settings";
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assignments", label: "Assignments", icon: FileText },
  { to: "/roadmaps", label: "Roadmaps", icon: Map },
  { to: "/compass", label: "Compass", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function handleSignOut() {
    analytics.userLoggedOut();
    await supabase.auth.signOut();
    resetAnalytics();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
          <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Academic Compass</span>
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

        {/* Mobile top nav */}
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Academic Compass</span>
          </Link>
        </div>

        <main className="min-h-screen flex-1 px-6 pb-24 pt-20 md:px-12 md:pt-10">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden">
          {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
