import path from "path";
import { createRequire } from "node:module";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PostgresPrismaClient } from "@prisma/client";
import { normalizePostgresSslMode } from "@/lib/postgres-url";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: unknown;
  prismaPgPool?: Pool;
};

const isVercelProduction = process.env.VERCEL_ENV === "production";
const runtimeRequire = createRequire(import.meta.url);

// Serverless (Vercel Lambda) 下的 pg.Pool 调参:
// - 每个 Lambda 实例只服务一个请求, 维持少量连接即可, 避免打爆 Neon 上游
// - 空闲连接尽快释放, 让冷连接不会被 PgBouncer 强制关闭后仍留在池里
// - acquire 超时要短于 Prisma driver adapter 内部的 permit 超时, 让错误尽快暴露
const PG_POOL_MAX = (() => {
  const raw = Number(process.env.PG_POOL_MAX);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return isVercelProduction ? 1 : 5;
})();
const PG_IDLE_TIMEOUT_MS = 10_000;
const PG_CONNECTION_TIMEOUT_MS = 10_000;

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
  const { PrismaClient } = runtimeRequire("../generated/prisma-local") as {
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

      // 跨 HMR / 多入口复用同一个 pg.Pool, 避免 Lambda 容器内连接数被放大
      const pool =
        globalForPrisma.prismaPgPool ??
        new Pool({
          connectionString: postgresUrl,
          max: PG_POOL_MAX,
          idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
        });

      if (!globalForPrisma.prismaPgPool) {
        // pg.Pool 在空闲连接出错时会 emit 'error', 不监听会让 Node 进程崩溃
        pool.on("error", (err) => {
          console.error("[prisma] pg pool idle client error", err);
        });
        globalForPrisma.prismaPgPool = pool;
      }

      const adapter = new PrismaPg(pool, {
        onPoolError: (err) => {
          console.error("[prisma] pg pool error", err);
        },
        onConnectionError: (err) => {
          console.error("[prisma] pg connection error", err);
        },
      });

      return new PostgresPrismaClient({
        adapter,
        log: logLevel,
      });
    })();

export const prisma = (globalForPrisma.prisma ?? prismaClient) as PostgresPrismaClient;

// 生产环境也缓存, 避免 Next.js 多入口 (app / pages / edge runtime build 输出) 各自 new 一次
globalForPrisma.prisma = prisma;
