/**
 * Lightweight JWT payload reader for route-protection decisions.
 *
 * This does NOT verify the signature — it only decodes the payload so the
 * proxy can decide which dashboard a request belongs to. Real authorization
 * is always enforced server-side by the backend on every endpoint. Treat the
 * values here as an unverified UX hint, never as a security boundary.
 */

export type Role = "admin" | "recruiter" | "candidate";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  exp: number; // seconds since epoch
  type: string;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const base64 = padded + pad;
  // atob is available in both the Node.js and Edge runtimes Next.js uses.
  return atob(base64);
}

/** Decode a JWT's payload, or return null if it is malformed. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as AccessTokenPayload;
    if (!payload.sub || !payload.role || !payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True when the token is absent, malformed, or past its expiry. */
export function isExpired(payload: AccessTokenPayload | null): boolean {
  if (!payload) return true;
  return payload.exp * 1000 <= Date.now();
}

/** The landing dashboard for each role. */
export function homeForRole(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "recruiter":
      return "/recruiter";
    case "candidate":
      return "/portal";
    default:
      return "/";
  }
}
