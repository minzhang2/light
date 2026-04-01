import process from "node:process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client";
import { normalizePostgresSslMode } from "../src/lib/postgres-url.js";
import { PrismaClient as LocalPrismaClient } from "../src/generated/prisma-local/index.js";
import { Pool } from "pg";

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function getPrismaClient() {
  const isVercelProduction = process.env.VERCEL_ENV === "production";
  const localDatabaseUrl =
    process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const postgresUrlRaw =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL;
  const postgresUrl = normalizePostgresSslMode(postgresUrlRaw);
  const useLocalSqlite =
    !isVercelProduction && typeof localDatabaseUrl === "string" && localDatabaseUrl.startsWith("file:");

  if (useLocalSqlite) {
    return new LocalPrismaClient({
      adapter: new PrismaBetterSqlite3({
        url: localDatabaseUrl,
      }),
    });
  }

  if (!postgresUrl || postgresUrl.startsWith("file:")) {
    throw new Error("Missing PostgreSQL URL for production role update.");
  }

  return new PostgresPrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: postgresUrl })),
  });
}

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    throw new Error("Usage: npm run user:grant-admin -- user@example.com");
  }

  const email = normalizeEmail(emailArg);
  const prisma = getPrismaClient();

  try {
    const updated = await prisma.user.update({
      where: { email },
      data: { role: "admin" },
      select: {
        email: true,
        role: true,
      },
    });

    console.log(`Granted ${updated.role} role to ${updated.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
