"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark";

type AppThemeContextValue = {
  theme: Theme;
  isMounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "app-theme";

const AppThemeContext = createContext<AppThemeContextValue | undefined>(
  undefined,
);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const subscribeToMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const isMounted = useSyncExternalStore(
    subscribeToMounted,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) =>
      currentTheme === "dark" ? "light" : "dark",
    );
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, isMounted, setTheme, toggleTheme }),
    [theme, isMounted, setTheme, toggleTheme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }

  return context;
}
