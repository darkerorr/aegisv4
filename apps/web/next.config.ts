import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Production builds and `next dev` must never write the same directory:
  // the supervisor keeps `next dev` alive while the launcher builds, and a
  // shared `.next` makes "Collecting page data" fail with ENOENT races.
  distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next",
  transpilePackages: ["@aegis/api-client", "@aegis/types"],
  experimental: { optimizePackageImports: ["lucide-react"] },
  headers: async () => [{
    source: "/:path*",
    headers: [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" }
    ]
  }]
};

export default nextConfig;
