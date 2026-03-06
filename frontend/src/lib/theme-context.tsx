"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type Theme = "dark" | "light";
type ThemeMode = "system" | "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  mode: "system",
  setMode: () => {},
});

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("sentinel-theme-mode");
  if (stored === "dark" || stored === "light") return stored;
  return "system";
}

function resolveTheme(mode: ThemeMode): Theme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(getInitialMode()));

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      if (mode === "system") {
        setTheme(mq.matches ? "light" : "dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Sync data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem("sentinel-theme-mode", next);
    setTheme(resolveTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
