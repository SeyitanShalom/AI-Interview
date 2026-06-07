import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getErrorMessage } from "@/lib/profileSchema";

export const dynamic = "force-dynamic";

type CompanySession = {
  id: string;
  user_id: string;
  job_role: string;
  question: string;
  status: string;
  overall_score: number | null;
  content_score: number | null;
  style_score: number | null;
  video_url: string | null;
  completed_at: string | null;
  created_at: string;
  ai_feedback: unknown | null;
  interview_kit_id?: string | null;
  company_id?: string | null;
  updated_at?: string;
};

function mergeSessions(...sessionGroups: CompanySession[][]) {
  const byId = new Map<string, CompanySession>();

  for (const group of sessionGroups) {
    for (const session of group) {
      byId.set(session.id, { ...byId.get(session.id), ...session });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function isMissingSessionColumnError(
  error: { code?: string; message?: string } | null,
  columnName: string,
) {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    (message.includes("schema cache") &&
      message.includes("could not find") &&
      message.includes(columnName.toLowerCase())) ||
    message.includes(`interview_sessions.${columnName.toLowerCase()}`) ||
    message.includes(`column ${columnName.toLowerCase()} does not exist`)
  );
}

async function hasSessionColumn(client: SupabaseClient, columnName: string) {
  const { error } = await client
    .from("interview_sessions")
    .select(columnName)
    .limit(1);

  if (!error) return true;
  if (isMissingSessionColumnError(error, columnName)) return false;

  throw error;
}

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

async function canAccessCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
) {
  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (membership) return true;

  const { data: ownedCompany, error: ownedCompanyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("created_by", userId)
    .maybeSingle();

  if (ownedCompanyError) {
    throw ownedCompanyError;
  }

  return Boolean(ownedCompany);
}

async function loadCompanySessions(client: SupabaseClient, companyId: string) {
  const { data: kits, error: kitsError } = await client
    .from("interview_kits")
    .select("id")
    .eq("company_id", companyId);

  if (kitsError) {
    throw kitsError;
  }

  const kitIds =
    kits
      ?.map((kit: { id?: unknown }) =>
        typeof kit.id === "string" ? kit.id : null,
      )
      .filter((kitId): kitId is string => Boolean(kitId)) ?? [];

  const [hasCompanyIdColumn, hasInterviewKitIdColumn] = await Promise.all([
    hasSessionColumn(client, "company_id"),
    hasSessionColumn(client, "interview_kit_id"),
  ]);

  let sessionsByCompany: CompanySession[] = [];

  if (hasCompanyIdColumn) {
    const { data, error } = await client
      .from("interview_sessions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    sessionsByCompany = (data as CompanySession[] | null) ?? [];
  }

  let sessionsByKit: CompanySession[] = [];

  if (hasInterviewKitIdColumn && kitIds.length > 0) {
    const { data: kitSessions, error: kitSessionsError } = await client
      .from("interview_sessions")
      .select("*")
      .in("interview_kit_id", kitIds)
      .order("created_at", { ascending: false });

    if (kitSessionsError) {
      if (!isMissingSessionColumnError(kitSessionsError, "interview_kit_id")) {
        throw kitSessionsError;
      }
    } else {
      sessionsByKit = (kitSessions as CompanySession[] | null) ?? [];
    }
  }

  return {
    hasCompanyIdColumn,
    hasInterviewKitIdColumn,
    kitIds,
    sessions: mergeSessions(sessionsByCompany, sessionsByKit),
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId")?.trim();

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

    if (!(await canAccessCompany(supabase, user.id, companyId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const sessionClient = admin ?? supabase;
    const { hasCompanyIdColumn, hasInterviewKitIdColumn, kitIds, sessions } =
      await loadCompanySessions(sessionClient, companyId);

    if (
      admin &&
      hasCompanyIdColumn &&
      hasInterviewKitIdColumn &&
      kitIds.length > 0
    ) {
      const { error: backfillError } = await admin
        .from("interview_sessions")
        .update({ company_id: companyId })
        .in("interview_kit_id", kitIds)
        .is("company_id", null);

      if (
        backfillError &&
        !isMissingSessionColumnError(backfillError, "interview_kit_id")
      ) {
        console.warn("Company session backfill failed", backfillError);
      }
    }

    const schemaIssue =
      !hasCompanyIdColumn || !hasInterviewKitIdColumn
        ? "Supabase is missing one or more interview session linkage columns. Run the latest migration to show all submitted company interviews."
        : null;

    return NextResponse.json({ sessions, schemaIssue });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "Unable to load company sessions." },
      { status: 500 },
    );
  }
}
