import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from './env';

// Single shared connection pool for the control plane.
// Lazy-initialized so importing this module doesn't read env vars — that
// matters during `next build`'s page-data collection step, which executes
// route modules in an environment without the real .env present.
// Hot-reloaded in dev so the pool isn't recreated on every code change.
const globalForDb = globalThis as unknown as { __subterradbPool?: Pool };

function getPool(): Pool {
  if (globalForDb.__subterradbPool) return globalForDb.__subterradbPool;
  const pool = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__subterradbPool = pool;
  } else {
    // In production we still want a single pool for the lifetime of the
    // process, just not via the dev hot-reload slot.
    globalForDb.__subterradbPool = pool;
  }
  return pool;
}

// Thin wrapper so call sites don't need to import pg types.
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params as unknown[]);
}

// Helper for short transactions. Rolls back on any thrown error.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
