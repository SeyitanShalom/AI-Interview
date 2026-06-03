import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing invite-code service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const inviteCode = code?.trim();

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Missing invite code" },
        { status: 400 },
      );
    }

    const adminClient = createServiceClient();
    const { data: company, error } = await adminClient
      .from("companies")
      .select("id, name")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json(
        { error: "Invite code not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      companyId: company.id,
      companyName: company.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
