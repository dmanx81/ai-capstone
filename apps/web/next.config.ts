import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@ai-capstone/shared"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
