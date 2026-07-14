import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // SQLite for V0; swap for a Postgres URL when it's time.
    url: `file:${path.join(__dirname, "prisma", "preflight.db")}`,
  },
});
