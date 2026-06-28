import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;
  const requestedPath = `${pathname}${request.nextUrl.search}`;
  const isCandidateDashboard =
    pathname === "/candidate/dashboard" ||
    pathname.startsWith("/candidate/dashboard/");
  const isCandidateProfile =
    pathname === "/candidate/profile" ||
    pathname.startsWith("/candidate/profile/");
  const isCandidateArea = isCandidateDashboard || isCandidateProfile;
  const isCompanyDashboard =
    pathname === "/company/dashboard" ||
    pathname.startsWith("/company/dashboard/");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const authPath = isCandidateArea ? "/candidate/auth" : "/company/auth";
    const loginUrl = new URL(authPath, request.url);
    loginUrl.searchParams.set("redirect", requestedPath);
    loginUrl.searchParams.set(
      "error",
      "Configuration error. Please contact support.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch (error) {
    console.warn("Unable to read Supabase auth user in proxy.", error);
  }

  if (!user && (isCandidateArea || isCompanyDashboard)) {
    const authPath = isCandidateArea ? "/candidate/auth" : "/company/auth";
    const loginUrl = new URL(authPath, request.url);
    loginUrl.searchParams.set("redirect", requestedPath);
    return NextResponse.redirect(loginUrl);
  }

  let role =
    typeof user?.user_metadata?.role === "string"
      ? user.user_metadata.role
      : null;

  if (user && (isCandidateArea || isCompanyDashboard)) {
    const expectedRole = isCandidateArea ? "candidate" : "company";

    if (role !== expectedRole) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", expectedRole)
        .limit(1);

      if (roles && roles.length > 0) {
        role = expectedRole;
      }
    }
  }

  if (isCandidateArea && role !== "candidate") {
    return NextResponse.redirect(new URL("/candidate/auth", request.url));
  }

  if (isCompanyDashboard && role !== "company") {
    return NextResponse.redirect(new URL("/company/auth", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/candidate/dashboard",
    "/candidate/dashboard/:path*",
    "/candidate/profile",
    "/candidate/profile/:path*",
    "/company/dashboard",
    "/company/dashboard/:path*",
  ],
};
