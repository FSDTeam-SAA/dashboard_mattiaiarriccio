import type { NextConfig } from "next";

const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN || "http://187.77.187.56:8082";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
