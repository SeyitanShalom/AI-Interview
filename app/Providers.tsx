"use client";

import { AuthProvider } from "@/lib/auth";
import { AppThemeProvider } from "./components/hooks/useAppTheme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppThemeProvider>
  );
}
