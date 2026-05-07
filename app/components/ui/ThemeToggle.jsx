"use client";
import { MoonIcon, SunIcon } from "lucide-react";

import { useAppTheme } from "@/app/components/hooks/useAppTheme";
import { Button } from "@/app/components/ui/button";

export const ThemeToggle = () => {
  const { theme, toggleTheme, isMounted } = useAppTheme();

  if (!isMounted) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed bottom-4 right-4 z-50 shadow-lg"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
};
