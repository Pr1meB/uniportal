import type { NextConfig } from "next";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8050").replace(/\/$/, "");

/**
 * The browser only ever talks to this origin. /api/* is proxied to Django so
 * the session + CSRF cookies are first-party (works on *.vercel.app without
 * third-party cookies).
 */
const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*/", destination: `${BACKEND_URL}/api/:path*/` },
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*/` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
