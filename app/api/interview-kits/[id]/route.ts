import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface SharedKit {
  id: string;
  title: string;
  job_role: string;
  questions: unknown;
  company_id: string;
  created_at: string;
}

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

function isMissingRpcError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("get_shared_interview_kit")
  );
}

function normalizeQuestions(rawQuestions: unknown) {
  if (Array.isArray(rawQuestions)) {
    return rawQuestions
      .map((question) => String(question).trim())
      .filter(Boolean);
  }

  if (typeof rawQuestions === "string") {
    try {
      const parsed = JSON.parse(rawQuestions) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((question) => String(question).trim())
          .filter(Boolean);
      }
    } catch {
      return rawQuestions.trim() ? [rawQuestions.trim()] : [];
    }
  }

  return [];
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
    const { data: sharedKit, error: sharedKitError } = await supabase
      .rpc("get_shared_interview_kit", { kit_uuid: kitId })
      .maybeSingle();

    let kit = sharedKit as SharedKit | null;

    if (sharedKitError && isMissingRpcError(sharedKitError)) {
      const { data: fallbackKit, error: fallbackError } = await supabase
        .from("interview_kits")
        .select("id, title, job_role, questions, company_id, created_at")
        .eq("id", kitId)
        .maybeSingle();

      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message },
          { status: 500 },
        );
      }

      kit = fallbackKit as SharedKit | null;
    } else if (sharedKitError) {
      return NextResponse.json(
        { error: sharedKitError.message },
        { status: 500 },
      );
    }

    if (!kit) {
      return NextResponse.json(
        { error: "Interview kit not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...kit,
      questions: normalizeQuestions(kit.questions),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
