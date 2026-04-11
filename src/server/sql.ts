import { Pool } from 'pg';
import { env } from './env';
import { query } from './db';
import { projectDatabaseName } from './project-db';
import type { SessionUser } from './auth';

// SQL execution service for the in-GUI SQL editor.
//
// Strategy:
//   - We open a short-lived pool to the project's database, connecting as the
//     per-project authenticator role (slug-prefixed).
//   - Inside a transaction, we SET LOCAL ROLE service_role so the query has
//     full read/write access regardless of RLS.
//   - We always execute inside a single connection so SET LOCAL is honored.
//   - On any error, the transaction rolls back so partially-completed
//     destructive statements are undone.
//
// Permission model: only admins (or developers assigned to the project) can
// hit the API endpoint that calls this. Inside the project database, the
// query runs as service_role with BYPASSRLS — same power level as the
// service_role key in the Supabase SDK.

interface ProjectRow {
  id: string;
  slug: string;
  db_password: string;
}

export interface SqlExecutionResult {
  /** Column names in result order. Empty for statements that don't return rows. */
  columns: string[];
  /** Rows as objects keyed by column name. */
  rows: Array<Record<string, unknown>>;
  /** Number of affected rows for INSERT/UPDATE/DELETE. */
  rowCount: number;
  /** Wall-clock time in milliseconds. */
  durationMs: number;
}

function safeIdentifier(slug: string): string {
  return slug.replace(/-/g, '_');
}

function authenticatorRoleName(slug: string): string {
  return `auth_${safeIdentifier(slug)}`;
}

function buildProjectUri(dbName: string, role: string, password: string): string {
  const url = new URL(env.databaseUrl);
  url.username = role;
  url.password = password;
  url.pathname = `/${dbName}`;
  return url.toString();
}

// ---------------------------------------------------------------------------
// Access check
// ---------------------------------------------------------------------------

async function loadProjectIfAccessible(
  user: SessionUser,
  projectId: string,
): Promise<ProjectRow> {
  const r = await query<ProjectRow>(
    `SELECT id, slug, db_password FROM projects WHERE id = $1`,
    [projectId],
  );
  const row = r.rows[0];
  if (!row) {
    throw Object.assign(new Error('Project not found'), {
      code: 'projects.not_found',
      status: 404,
    });
  }
  if (user.role !== 'admin') {
    const access = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id],
    );
    if (access.rowCount === 0) {
      throw Object.assign(new Error('Forbidden'), {
        code: 'projects.forbidden',
        status: 403,
      });
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export async function executeSql(
  user: SessionUser,
  projectId: string,
  sql: string,
): Promise<SqlExecutionResult> {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Empty query'), {
      code: 'sql.empty_query',
      status: 400,
    });
  }

  const project = await loadProjectIfAccessible(user, projectId);
  const dbName = projectDatabaseName(project.slug);
  const role = authenticatorRoleName(project.slug);
  const uri = buildProjectUri(dbName, role, project.db_password);

  const pool = new Pool({ connectionString: uri, max: 1 });
  const client = await pool.connect();
  const start = Date.now();
  try {
    // SET LOCAL only takes effect inside a transaction, which is fine because
    // we want the rollback semantics for failed queries anyway.
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE service_role');
    const result = await client.query(trimmed);
    await client.query('COMMIT');

    // If the query looks like DDL, notify PostgREST so it reloads its
    // schema cache. Without this, new tables/columns return 404 until
    // the container is restarted.
    if (/^\s*(CREATE|ALTER|DROP)\s/i.test(trimmed)) {
      await client.query("NOTIFY pgrst, 'reload schema'");
    }

    const durationMs = Date.now() - start;
    const columns = (result.fields ?? []).map((f) => f.name);
    const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
    return {
      columns,
      rows,
      rowCount: result.rowCount ?? rows.length,
      durationMs,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    throw Object.assign(new Error(message), {
      code: 'sql.execution_failed',
      status: 400,
      details: { message, durationMs },
    });
  } finally {
    client.release();
    await pool.end();
  }
}
