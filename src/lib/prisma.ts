import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client";
import { PrismaClient as LocalPrismaClient } from "@/generated/prisma-local";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: unknown;
};

const isVercelProduction = process.env.VERCEL_ENV === "production";

const localDatabaseUrl =
  process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const postgresUrl =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

const useLocalSqlite = !isVercelProduction && localDatabaseUrl.startsWith("file:");

const logLevel: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

const prismaClient = useLocalSqlite
  ? new LocalPrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: localDatabaseUrl,
      }),
      log: logLevel,
    })
  : (() => {
      if (!postgresUrl || postgresUrl.startsWith("file:")) {
        throw new Error(
          "Missing PostgreSQL URL. Set POSTGRES_PRISMA_URL (or POSTGRES_URL_NON_POOLING) for production/local-postgres.",
        );
      }

      const pool = new Pool({ connectionString: postgresUrl });
      const adapter = new PrismaPg(pool);

      return new PostgresPrismaClient({
        adapter,
        log: logLevel,
      });
    })();

export const prisma = (globalForPrisma.prisma ?? prismaClient) as PostgresPrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
