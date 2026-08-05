import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decodeAccessToken, isExpired, homeForRole, type Role } from "@/lib/jwt";

/**
 * Route protection for the three role-scoped dashboard areas.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`. This runs on the
 * server before protected routes render and gates them by the `role` claim in
 * the access-token cookie. It is a UX gate only — the backend independently
 * enforces authorization on every API call.
 */

// This app only serves the recruiter dashboard.
const AREA_ROLE: Role = "recruiter";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The recruiter session has its own cookie namespace (recruiter_access_token)
  // so it stays isolated from the candidate and admin apps sharing this backend.
  const token = request.cookies.get(`${AREA_ROLE}_access_token`)?.value;
  const payload = token ? decodeAccessToken(token) : null;

  // No usable session → send to login, remembering where they were headed.
  if (isExpired(payload)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but not as a recruiter → bounce to their own dashboard.
  if (payload!.role !== AREA_ROLE) {
    return NextResponse.redirect(new URL(homeForRole(payload!.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/recruiter", "/recruiter/:path*"],
};
