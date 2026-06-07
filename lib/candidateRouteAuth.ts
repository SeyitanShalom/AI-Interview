import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function candidateAuthUrl(nextPath: string) {
  return `/candidate/auth?redirect=${encodeURIComponent(nextPath)}`;
}

export async function requireCandidateForPath(nextPath: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server components may not always be able to set refreshed cookies.
          }
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(candidateAuthUrl(nextPath));
  }

  if (user.user_metadata?.role === "candidate") {
    return { supabase, user };
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "candidate")
    .limit(1);

  if (roles && roles.length > 0) {
    return { supabase, user };
  }

  redirect(candidateAuthUrl(nextPath));
}
