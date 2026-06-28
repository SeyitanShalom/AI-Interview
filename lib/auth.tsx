"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Subscription } from "@supabase/auth-js";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: Subscription | null = null;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const clearAuthState = () => {
      applySession(null);
    };

    const initAuth = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, nextSession: Session | null) => {
            applySession(nextSession);
          },
        );

        if (!isMounted) {
          sub.unsubscribe();
          return;
        }

        subscription = sub;

        const { data } = await supabase.auth.getSession();
        applySession(data.session);
      } catch (error) {
        console.warn("Unable to initialize Supabase auth session.", error);
        clearAuthState();
      }
    };

    void initAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    const { supabase } = await import("@/lib/supabase");

    const { error } = await supabase.auth.signOut({ scope: "global" });

    // clear local state immediately so UI/middleware checks don't lag
    setSession(null);
    setUser(null);
    setLoading(false);

    // remove old custom cookie if it existed from previous middleware approach
    document.cookie = "user-role=; path=/; max-age=0; samesite=lax";

    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
