import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SECURE_INVITE_TTL_HOURS = 24;

function createSupabaseServerClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration.");
  }

  return createServerClient(supabaseUrl, supabaseKey, {
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

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing secure share service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      companyId?: string;
    };
    const companyId = body.companyId?.trim();

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    const adminClient = createServiceClient();
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, name, created_by")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { data: membership } = await adminClient
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    const canCreateLink =
      company.created_by === user.id || membership?.role === "admin";

    if (!canCreateLink) {
      return NextResponse.json(
        { error: "Only company admins can create secure links." },
        { status: 403 },
      );
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(
      Date.now() + SECURE_INVITE_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await adminClient
      .from("company_invite_links")
      .insert({
        company_id: companyId,
        token,
        created_by: user.id,
        expires_at: expiresAt,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const inviteUrl = new URL("/company/auth", request.url);
    inviteUrl.searchParams.set("secure", token);

    return NextResponse.json({
      token,
      url: inviteUrl.toString(),
      expiresAt,
      companyId,
      companyName: company.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
