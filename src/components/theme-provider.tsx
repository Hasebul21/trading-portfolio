"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  /** The resolved theme actually applied to <html>. */
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "trading-ui-theme";
const DEFAULT_THEME: ThemeMode = "dark";
const THEME_CHANGE_EVENT = "trading-ui-theme-change";

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the theme from <html>'s class list — the no-FOUC inline script (see
 * RootLayout) sets this before React hydrates, so it's the authoritative
 * source of "what the user is actually seeing right now".
 */
function readDomTheme(): ThemeMode {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/**
 * Tiny client-side theme provider — no extra deps. The single source of
 * truth is the `.dark` class on <html>; we use useSyncExternalStore so the
 * React tree stays in sync without setting state inside an effect.
 *
 * The inline NO_FOUC_THEME_SCRIPT applies the persisted preference before
 * hydration so first paint is never wrong.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readDomTheme,
    () => DEFAULT_THEME,
  );

  // On first mount, reconcile localStorage with the DOM in case the inline
  // script and a stale class disagree (rare but possible during dev HMR).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && stored !== readDomTheme()) {
      applyTheme(stored);
    }
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(readDomTheme() === "dark" ? "light" : "dark");
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Apply the theme class to <html>, persist it, and notify subscribers. */
function applyTheme(next: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (next === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota / private-mode failures */
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Allow consumption outside a provider (during static rendering) —
    // fall back to a no-op snapshot.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Inline script (rendered into <head>) that applies the correct theme class
 * before React hydrates, so we never paint the wrong palette on first frame.
 */
export const NO_FOUC_THEME_SCRIPT = `(function(){try{var k='${STORAGE_KEY}';var v=localStorage.getItem(k);if(v!=='dark'&&v!=='light')v='${DEFAULT_THEME}';var d=document.documentElement;if(v==='dark')d.classList.add('dark');else d.classList.remove('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
