import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // SQLite for V0; DATABASE_URL overrides (Postgres also needs the
    // driver-adapter swap — see docs/PRODUCTION.md).
    url:
      process.env.DATABASE_URL ??
      `file:${path.join(__dirname, "prisma", "preflight.db")}`,
  },
});
