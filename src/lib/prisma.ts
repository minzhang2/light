import path from "path";
import { createRequire } from "node:module";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client";
import { normalizePostgresSslMode } from "@/lib/postgres-url";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: unknown;
};

const isVercelProduction = process.env.VERCEL_ENV === "production";
const runtimeRequire = createRequire(import.meta.url);

function normalizeSqliteFileUrl(url: string) {
  // prisma 的 sqlite 使用 `file:` 连接串；如果传入的是相对路径，会受当前进程工作目录影响。
  // 为了避免运行时连到“另一个 dev.db”，这里统一转成项目根目录下的绝对路径。
  if (!url.startsWith("file:")) return url;

  const withoutScheme = url.slice("file:".length); // keep query if any
  const [filePart, queryPart] = withoutScheme.split("?");
  const absPath = path.isAbsolute(filePart)
    ? filePart
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), filePart);

  return queryPart ? `file:${absPath}?${queryPart}` : `file:${absPath}`;
}

const localDatabaseUrlRaw =
  process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";

const localDatabaseUrl = normalizeSqliteFileUrl(localDatabaseUrlRaw);
const postgresUrlRaw =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;
const postgresUrl =
  typeof postgresUrlRaw === "string" ? normalizePostgresSslMode(postgresUrlRaw) : postgresUrlRaw;

const useLocalSqlite = !isVercelProduction && localDatabaseUrl.startsWith("file:");

const logLevel: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

function createLocalPrismaClient() {
  // Next.js 16 production builds use Turbopack by default.
  // Loading the generated sqlite client lazily keeps the local-only client
  // out of the production server bundle on Vercel.
  const localClientPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "src/generated/prisma-local",
  );
  const { PrismaClient } = runtimeRequire(localClientPath) as {
    PrismaClient: new (options: {
      adapter: PrismaBetterSqlite3;
      log: ("error" | "warn")[];
    }) => PostgresPrismaClient;
  };

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: localDatabaseUrl,
    }),
    log: logLevel,
  });
}

const prismaClient = useLocalSqlite
  ? createLocalPrismaClient()
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
