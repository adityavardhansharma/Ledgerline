import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ledgerline/ui"],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
