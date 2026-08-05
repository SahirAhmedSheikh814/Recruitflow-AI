import type { NextConfig } from "next";

/**
 * Website + Candidate Portal.
 *
 * NEXT_PUBLIC_PORTAL is fixed to "candidate" for this deployment so the API
 * client sends the `X-Portal: candidate` header and the backend reads the
 * candidate-scoped auth cookie. This keeps candidate sessions isolated from the
 * separately-deployed Recruiter and Admin apps that share the same backend.
 */
const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PORTAL: "candidate",
  },
  // Same-origin API proxy. Browser calls hit `/backend/*` on THIS Vercel domain
  // and are transparently proxied to the backend on Render. Because the response
  // (including the Google-OAuth callback's Set-Cookie) appears to come from this
  // origin, the auth cookies are stored first-party and are readable by proxy.ts.
  // Without this, cookies set by the onrender.com response bind to that domain and
  // the Vercel middleware never sees them.
  async rewrites() {
    return [
      { source: "/backend/:path*", destination: `${BACKEND_ORIGIN}/:path*` },
    ];
  },
  // Resume (PDF/DOCX) and avatar (up to 5 MB) uploads pass through the proxy.
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
