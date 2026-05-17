import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  const { pathname } = request.nextUrl;
  const requestedPath = `${pathname}${request.nextUrl.search}`;
  const isCandidateDashboard =
    pathname === "/candidate/dashboard" ||
    pathname.startsWith("/candidate/dashboard/");
  const isCandidateProfile =
    pathname === "/candidate/profile" || pathname.startsWith("/candidate/profile/");
  const isCandidateArea = isCandidateDashboard || isCandidateProfile;
  const isCompanyDashboard =
    pathname === "/company/dashboard" ||
    pathname.startsWith("/company/dashboard/");

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
