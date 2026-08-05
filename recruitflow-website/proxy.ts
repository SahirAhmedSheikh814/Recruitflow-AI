import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decodeAccessToken, isExpired, homeForRole } from "@/lib/jwt";

/**
 * Route protection for the candidate portal.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`. This runs on the
 * server before protected routes render and gates them by the `role` claim in
 * the access-token cookie. It is a UX gate only — the backend independently
 * enforces authorization on every API call.
 *
 * This app owns the public site + candidate portal, so it only gates `/portal`
 * and reads the candidate-scoped cookie.
 */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/portal" && !pathname.startsWith("/portal/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("candidate_access_token")?.value;
  const payload = token ? decodeAccessToken(token) : null;

  // No usable session → send to login, remembering where they were headed.
  if (isExpired(payload)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but not a candidate → bounce to the candidate home.
  if (payload!.role !== "candidate") {
    return NextResponse.redirect(new URL(homeForRole(payload!.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
