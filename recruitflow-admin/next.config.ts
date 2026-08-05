import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_PORTAL: "admin" },
  // Same-origin API proxy. Browser calls hit `/backend/*` on THIS Vercel domain
  // and are transparently proxied to the backend on Render, so auth cookies are
  // stored first-party and are readable by proxy.ts. Without this, cookies set by
  // the onrender.com response bind to that domain and the middleware never sees them.
  async rewrites() {
    return [
      { source: "/backend/:path*", destination: `${BACKEND_ORIGIN}/:path*` },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
