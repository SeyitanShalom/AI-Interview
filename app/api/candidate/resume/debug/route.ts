import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    // Try cookie-based session first
    let ownerId: string | null = null;

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData?.user) ownerId = userData.user.id;

    if (!ownerId) {
      const authHeader =
        request.headers.get("authorization") ||
        request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const token = authHeader.split(" ")[1];

      const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userResp.ok)
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      const userJson = await userResp.json();
      ownerId = userJson?.id ?? null;
    }

    if (!ownerId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole)
      return NextResponse.json(
        { error: "Service role missing" },
        { status: 500 },
      );

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("user_id", ownerId)
      .single();

    if (error) {
      console.error("[resume-debug] select error:", error);
      return NextResponse.json(
        { error: error.message || "DB error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
