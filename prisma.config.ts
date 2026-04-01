import "dotenv/config";
import { defineConfig } from "prisma/config";
import { normalizePostgresSslMode } from "./src/lib/postgres-url.js";

const isVercelProduction = process.env.VERCEL_ENV === "production";

const datasourceUrl = isVercelProduction
  ? normalizePostgresSslMode(
      process.env.POSTGRES_URL_NON_POOLING ??
        process.env.POSTGRES_PRISMA_URL ??
        process.env.DATABASE_URL,
    )
  : process.env.LOCAL_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
