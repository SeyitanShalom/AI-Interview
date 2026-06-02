import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type EmailOtpType } from "@supabase/supabase-js";

const DEFAULT_REDIRECT = "/";

// Prevent this route from being prerendered
export const dynamic = "force-dynamic";

function safeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  return rawNext;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL(
        `/candidate/auth?error=${encodeURIComponent("Configuration error. Please contact support.")}`,
        request.url,
      ),
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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

  let errorMessage: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      errorMessage = error.message;
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      errorMessage = error.message;
    }
  } else {
    errorMessage = "Missing verification parameters.";
  }

  if (errorMessage) {
    const fallbackAuthPath = next.startsWith("/candidate")
      ? "/candidate/auth"
      : "/company/auth";
    const errorUrl = new URL(fallbackAuthPath, request.url);
    errorUrl.searchParams.set("error", errorMessage);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
