"use client";

import { AuthProvider } from "@/lib/auth";
import { AppThemeProvider } from "./components/hooks/useAppTheme";
import { ScrollToTopOnHome } from "./components/ScrollToTopOnHome";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <AuthProvider>{children}</AuthProvider>
      <ScrollToTopOnHome />
    </AppThemeProvider>
  );
}
