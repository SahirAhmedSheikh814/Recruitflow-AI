import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decodeAccessToken, isExpired, homeForRole, type Role } from "@/lib/jwt";

// This app only serves the admin dashboard.
const AREA_ROLE: Role = "admin";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(`${AREA_ROLE}_access_token`)?.value;
  const payload = token ? decodeAccessToken(token) : null;

  if (isExpired(payload)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (payload!.role !== AREA_ROLE) {
    return NextResponse.redirect(new URL(homeForRole(payload!.role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
