import type { NextConfig } from "next";

// The dashboard now calls the backend directly via NEXT_PUBLIC_API_BASE_URL
// (full URL), so the dev/prod rewrite proxy is no longer needed.
const nextConfig: NextConfig = {};

export default nextConfig;
