import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

async function loadInvite(token: string) {
  const adminClient = createServiceClient();
  const { data, error } = await adminClient
    .from("company_invite_links")
    .select("id, company_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return { error: "Invite link not found", status: 404 } as const;
  }

  if (data.used_at) {
    return {
      error: "This secure link has already been used.",
      status: 410,
    } as const;
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { error: "This secure link has expired.", status: 410 } as const;
  }

  const { data: company } = await adminClient
    .from("companies")
    .select("name")
    .eq("id", data.company_id)
    .maybeSingle();

  return {
    invite: data,
    companyName: company?.name ?? null,
  } as const;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const safeToken = token?.trim();

    if (!safeToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const result = await loadInvite(safeToken);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      companyId: result.invite.company_id,
      companyName: result.companyName,
      expiresAt: result.invite.expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const safeToken = token?.trim();

    if (!safeToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await loadInvite(safeToken);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const adminClient = createServiceClient();
    const { data: redeemedInvite, error: redeemError } = await adminClient
      .from("company_invite_links")
      .update({
        used_at: new Date().toISOString(),
        used_by: user.id,
      })
      .eq("token", safeToken)
      .is("used_at", null)
      .select("company_id")
      .maybeSingle();

    if (redeemError || !redeemedInvite) {
      return NextResponse.json(
        { error: "This secure link could not be redeemed." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      companyId: redeemedInvite.company_id,
      companyName: result.companyName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
