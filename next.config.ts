import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co"
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com"
      },
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com"
      }
    ]
  },
  poweredByHeader: false
};

export default nextConfig;
