import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.robinhood.com" },
      { protocol: "https", hostname: "robinhood.com" },
    ],
  },
};

export default nextConfig;
