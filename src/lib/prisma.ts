import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const isVercelProduction = process.env.VERCEL_ENV === "production";

const connectionString = isVercelProduction
  ? process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL
  : process.env.LOCAL_DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing PostgreSQL URL. Set LOCAL_DATABASE_URL for local dev, and POSTGRES_PRISMA_URL for Vercel.",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
