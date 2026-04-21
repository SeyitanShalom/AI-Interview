import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

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
  const isCandidateDashboard =
    pathname === "/candidate/dashboard" ||
    pathname.startsWith("/candidate/dashboard/");
  const isCompanyDashboard =
    pathname === "/company/dashboard" ||
    pathname.startsWith("/company/dashboard/");

  if (!user && (isCandidateDashboard || isCompanyDashboard)) {
    const authPath = isCandidateDashboard ? "/candidate/auth" : "/company/auth";
    const loginUrl = new URL(authPath, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = user?.user_metadata?.role;

  if (isCandidateDashboard && role !== "candidate") {
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
    "/company/dashboard",
    "/company/dashboard/:path*",
  ],
};
