import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this project when a parent directory also
  // contains a package lockfile (common in local workspaces).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
