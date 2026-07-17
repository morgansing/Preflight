import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config } from "./config";

// One PrismaClient per process — Next dev hot-reload would otherwise
// open a new connection pool on every recompile. Prisma 7 connects via
// a driver adapter; DATABASE_URL overrides the default file next to the
// schema (see docs/PRODUCTION.md for the Postgres adapter swap).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: config.databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
