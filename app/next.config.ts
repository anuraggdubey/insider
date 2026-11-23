import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  transpilePackages: ["@insider/sdk"],
  turbopack: {
    resolveAlias: {
      fs: { browser: "./src/lib/browser-fs.ts" },
      buffer: { browser: "next/dist/compiled/buffer" },
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
