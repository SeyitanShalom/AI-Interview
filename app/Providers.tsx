"use client";

import { AuthProvider } from "@/lib/auth";
import { SplashScreen } from "./components/SplashScreen";
import { AppThemeProvider } from "./components/hooks/useAppTheme";
import { ScrollToTopOnHome } from "./components/ScrollToTopOnHome";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <AuthProvider>{children}</AuthProvider>
      <ScrollToTopOnHome />
      <SplashScreen />
    </AppThemeProvider>
  );
}
