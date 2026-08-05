import type { NextConfig } from "next";

/**
 * Website + Candidate Portal.
 *
 * NEXT_PUBLIC_PORTAL is fixed to "candidate" for this deployment so the API
 * client sends the `X-Portal: candidate` header and the backend reads the
 * candidate-scoped auth cookie. This keeps candidate sessions isolated from the
 * separately-deployed Recruiter and Admin apps that share the same backend.
 */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PORTAL: "candidate",
  },
};

export default nextConfig;
