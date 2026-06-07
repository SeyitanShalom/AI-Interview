import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSharedInterviewKit } from "@/lib/interviewKitAccess";

export const dynamic = "force-dynamic";

function createSupabaseServerClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const kitId = id?.trim();

    if (!kitId) {
      return NextResponse.json({ error: "Missing kit id" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in as a candidate to access this interview kit." },
        { status: 401 },
      );
    }

    const isCandidateFromMetadata = user.user_metadata?.role === "candidate";
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "candidate")
      .limit(1);
    const isCandidateFromTable = Boolean(roles && roles.length > 0);

    if (!isCandidateFromMetadata && !isCandidateFromTable) {
      return NextResponse.json(
        { error: "Sign in with a candidate account to access this interview." },
        { status: 403 },
      );
    }

    const kit = await getSharedInterviewKit(supabase, kitId);

    if (!kit) {
      return NextResponse.json(
        { error: "Interview kit not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(kit);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
