import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "compass-theme";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" };
const ThemeContext = createContext<Ctx | null>(null);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && (localStorage.getItem(KEY) as Theme | null)) || "system";
    setThemeState(stored);
    applyTheme(stored);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) || "system") === "system") {
        applyTheme("system");
        setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, t);
    applyTheme(t);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  };

  return <ThemeContext.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
