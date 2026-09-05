// pages/_app.tsx

// ==============================
// Imports
// ==============================
// Global styles / vendor CSS (order matters)
import "../styles/globals.css";
import "../styles/theme.global.css"; // mapează tokens → elemente

// Theme classes (Vanilla Extract) — DIRECT din tokens (fără shim)
import { themeClassDark, themeClassLight } from "@taxi/tokens";
import type { AppProps } from "next/app";
import { createContext, useContext, useEffect, useState } from "react";

// App layout
import Layout from "../components/Layout";
// Container scope + tema implicită a containerului — wrapper global permis
import { containerThemeDefault, pageScope } from "../styles/container.css";

// ==============================
// Constante & Utils (SSR-safe)
// ==============================
type ThemeMode = "light" | "dark";

const THEME_KEY = "theme" as const;
const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)" as const;
const isProd = process.env.NODE_ENV === "production";

/** Dev-only warning (nu poluează consola în producție) */
function devWarn(message: string): void {
  if (!isProd && typeof console !== "undefined") {
    // no-console
    console.warn(`[KonceptID] ${message}`);
  }
}

/** localStorage safe (evită excepții în privacy mode / SSR) */
const safeStorage = {
  get(key: string): string | null {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    } catch {
      devWarn("localStorage indisponibil (get).");
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    } catch {
      devWarn("localStorage indisponibil (set).");
    }
  },
};

// ==============================
// Theme Context (intern aplicației)
// ==============================
type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  userOverride: boolean;
  setUserOverride: (v: boolean) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Hook public minim pentru accesul la temă din orice componentă */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <App />");
  return ctx;
}

// ==============================
// Component
// ==============================
export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [userOverride, setUserOverride] = useState<boolean>(false);

  // 1) Init din localStorage / system preference (SSR-safe)
  useEffect(() => {
    const saved = safeStorage.get(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      setUserOverride(true);
      return;
    }

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia(PREFERS_DARK_QUERY);
      setTheme(mq.matches ? "dark" : "light");
      setUserOverride(false);
    } else {
      devWarn("window.matchMedia nu este disponibil; fallback pe tema 'light'.");
      setTheme("light");
      setUserOverride(false);
    }
  }, []);

  // 2) Reacționează la schimbarea preferinței de sistem (doar dacă nu există override de la user)
  useEffect(() => {
    if (userOverride) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(PREFERS_DARK_QUERY);
    const onChange = (): void => setTheme(mq.matches ? "dark" : "light");

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    const legacy = mq as unknown as {
      addListener?: (cb: () => void) => void;
      removeListener?: (cb: () => void) => void;
    };

    if (typeof legacy.addListener === "function" && typeof legacy.removeListener === "function") {
      legacy.addListener(onChange);
      return () => legacy.removeListener!(onChange);
    }
  }, [userOverride]);

  // 3) Sync între tab-uri (user schimbă tema într-un alt tab)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent): void => {
      if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
        setUserOverride(true);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 4) Aplică tema pe <html> (semantic + clase VE) și persistă (SSR-safe)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    root.classList.remove("light", "dark", themeClassLight, themeClassDark);
    root.setAttribute("data-theme", theme);

    if (theme === "dark") {
      root.classList.add("dark", themeClassDark);
    } else {
      root.classList.add("light", themeClassLight);
    }

    safeStorage.set(THEME_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        userOverride,
        setUserOverride,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      <div className={`${pageScope} ${containerThemeDefault}`}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </div>
    </ThemeContext.Provider>
  );
}
