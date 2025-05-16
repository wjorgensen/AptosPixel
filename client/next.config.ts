import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  reactStrictMode: true,
  env: {
    APTOS_API_KEY: process.env.APTOS_API_KEY,
  },
};

export default nextConfig;
