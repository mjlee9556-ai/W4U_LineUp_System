import "server-only";
import { findDatabaseUrl } from "@/lib/database-url";
import { SCHEMA_SQL } from "@/lib/schema";

// Postgres 주소(DATABASE_URL 등, findDatabaseUrl 참고)가 있으면 그 Postgres(Vercel Storage의 Neon 등)를 쓰고,
// 없으면 서버 안에 들어 있는 PGlite를 ./data 폴더에 저장해서 쓴다(별도 설치·계정 불필요).

type Row = Record<string, unknown>;
type Queryable = { query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };
type Db = Queryable & { transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> };

// 날짜·시각은 문자열 그대로 받는다 (date → 'YYYY-MM-DD')
const DATE_OID = 1082;
const TIMESTAMPTZ_OID = 1184;

async function createPostgres(url: string): Promise<Db> {
  const pg = await import("pg");
  const Pool = pg.default.Pool;
  pg.default.types.setTypeParser(DATE_OID, (v: string) => v);
  pg.default.types.setTypeParser(TIMESTAMPTZ_OID, (v: string) => v);
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    max: 3,
  });
  return {
    query: (sql, params) => pool.query(sql, params) as never,
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({ query: (sql, params) => client.query(sql, params) as never });
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(): Promise<Db> {
  if (process.env.VERCEL) {
    // 값은 빼고 이름만 남겨서 어떤 환경 변수가 들어왔는지 로그로 확인할 수 있게 한다
    const names = Object.keys(process.env).filter((k) => /URL|POSTGRES|PG|DATABASE/.test(k)).sort().join(", ");
    throw new Error(
      `Vercel에서는 Storage 탭에서 Postgres 데이터베이스를 연결하고 Redeploy 해야 해요 (postgres 주소를 못 찾음). 보이는 환경 변수: ${names || "없음"}`,
    );
  }
  const { PGlite, types } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? "./data/pglite";
  const db = new PGlite(dir === "memory" ? undefined : dir, {
    parsers: { [types.DATE]: (v: string) => v, [types.TIMESTAMPTZ]: (v: string) => v },
  });
  return {
    query: (sql, params) => db.query(sql, params) as never,
    transaction: (fn) => db.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params) as never })),
  };
}

async function init(): Promise<Db> {
  const url = findDatabaseUrl(process.env);
  const db = url ? await createPostgres(url) : await createPglite();
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(4242)");
    for (const statement of SCHEMA_SQL.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
      await tx.query(statement);
    }
  });
  return db;
}

// 개발 서버 새로고침에도 연결을 하나만 쓰도록 globalThis에 보관
const g = globalThis as unknown as { __j4uDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__j4uDb ??= init().catch((e) => {
    g.__j4uDb = undefined;
    throw e;
  });
  return g.__j4uDb;
}

export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return (await db.query<T>(sql, params)).rows;
}

export async function queryOne<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null;
}

export async function transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}
