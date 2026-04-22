import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export type PgQueryable = Pool | PoolClient;

export function getPgPool(): Pool {
  const connectionString = normalizeEnvValue(process.env.DATABASE_URL);

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

function normalizeEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.length >= 2 &&
    ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getPgPool().query<T>(text, [...values]);
}
