import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16 turns the Turbopack filesystem cache on by default for `next dev`. On this machine's
    // slow E: drive ("Slow filesystem detected", cache compactions of 100 s+) the dev server
    // stopped compiling new pages (requests hung with 0% CPU). Compiling from memory avoids that;
    // set back to true if the project moves to a fast local disk.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
