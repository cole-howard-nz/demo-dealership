/**
 * Northbridge Motors — Staff Portal
 * Prisma singleton
 *
 * In development, Next.js hot-reloading can create multiple Prisma instances.
 * This pattern re-uses a single global instance to avoid connection pool
 * exhaustion during development.
 */

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
