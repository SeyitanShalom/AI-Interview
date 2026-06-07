import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getErrorMessage } from "@/lib/profileSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECORDINGS_BUCKET = "interview-recordings";

type RouteContext = {
  params: Promise<{ sessionId: string }> | { sessionId: string };
};

type InterviewSessionRow = {
  id: string;
  company_id?: string | null;
  interview_kit_id?: string | null;
  video_url?: string | null;
};

function createAnonServerClient(
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

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) return null;

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}

async function canManageCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
) {
  const { data: ownedCompany, error: ownedCompanyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("created_by", userId)
    .maybeSingle();

  if (ownedCompanyError) {
    throw ownedCompanyError;
  }

  if (ownedCompany) return true;

  const { data: adminMembership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  return Boolean(adminMembership);
}

async function sessionBelongsToCompany(
  admin: SupabaseClient,
  session: InterviewSessionRow,
  companyId: string,
) {
  if (session.company_id === companyId) return true;

  if (!session.interview_kit_id) return false;

  const { data: kit, error } = await admin
    .from("interview_kits")
    .select("company_id")
    .eq("id", session.interview_kit_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return kit?.company_id === companyId;
}

function getStoragePath(videoUrl: string) {
  try {
    const url = new URL(videoUrl);
    const publicPrefix = `/storage/v1/object/public/${RECORDINGS_BUCKET}/`;
    const signedPrefix = `/storage/v1/object/sign/${RECORDINGS_BUCKET}/`;
    const path = decodeURIComponent(url.pathname);

    if (path.includes(publicPrefix)) {
      return path.split(publicPrefix)[1] || null;
    }

    if (path.includes(signedPrefix)) {
      return path.split(signedPrefix)[1] || null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const cleanSessionId = sessionId?.trim();

    if (!cleanSessionId) {
      return NextResponse.json(
        { error: "Missing interview session id" },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      companyId?: string;
    };
    const companyId = body.companyId?.trim();

    if (!companyId) {
      return NextResponse.json(
        { error: "Missing company id" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const supabase = createAnonServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canManageCompany(supabase, user.id, companyId))) {
      return NextResponse.json(
        { error: "Only company admins can delete candidate reviews." },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to the server environment so admins can delete candidate reviews.",
        },
        { status: 500 },
      );
    }

    const { data: session, error: sessionError } = await admin
      .from("interview_sessions")
      .select("*")
      .eq("id", cleanSessionId)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        { error: getErrorMessage(sessionError) || "Review lookup failed" },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Candidate review not found" },
        { status: 404 },
      );
    }

    const sessionRow = session as InterviewSessionRow;
    if (!(await sessionBelongsToCompany(admin, sessionRow, companyId))) {
      return NextResponse.json(
        { error: "Candidate review does not belong to this company." },
        { status: 403 },
      );
    }

    const { error: deleteError } = await admin
      .from("interview_sessions")
      .delete()
      .eq("id", cleanSessionId);

    if (deleteError) {
      return NextResponse.json(
        { error: getErrorMessage(deleteError) || "Review delete failed" },
        { status: 500 },
      );
    }

    const storagePath = sessionRow.video_url
      ? getStoragePath(sessionRow.video_url)
      : null;

    if (storagePath) {
      const { error: storageError } = await admin.storage
        .from(RECORDINGS_BUCKET)
        .remove([storagePath]);

      if (storageError) {
        console.warn("Candidate review recording cleanup failed", storageError);
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          getErrorMessage(error) || "Unable to delete candidate review.",
      },
      { status: 500 },
    );
  }
}
