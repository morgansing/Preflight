import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// One PrismaClient per process — Next dev hot-reload would otherwise
// open a new connection pool on every recompile. Prisma 7 connects via
// a driver adapter; the DB file lives next to the schema.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: `file:${path.join(process.cwd(), "prisma", "preflight.db")}`,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
