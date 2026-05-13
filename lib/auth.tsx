"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

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
    let subscription: any = null;

    const initAuth = async () => {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        },
      );
      subscription = sub;

      supabase.auth
        .getSession()
        .then(({ data }: { data: { session: Session | null } }) => {
          const { session } = data;
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
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
