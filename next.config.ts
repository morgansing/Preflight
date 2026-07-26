import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Absolute project root — process.cwd() alone is not enough when a parent
// directory also has a package-lock.json (Next then treats that parent as
// the Turbopack root and client manifests break with "Could not find the
// module … in the React Client Manifest").
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
