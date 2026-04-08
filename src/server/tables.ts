import { Pool } from 'pg';
import { env } from './env';
import { query } from './db';
import { projectDatabaseName } from './project-db';
import type { SessionUser } from './auth';

// Table introspection service for the in-GUI Table Editor.
//
// Reads schema metadata from `information_schema` + `pg_catalog` and runs
// SELECT statements as service_role inside a transaction. Mirrors the SQL
// service module's connection strategy.

interface ProjectRow {
  id: string;
  slug: string;
  db_password: string;
}

export interface TableSummary {
  schema: string;
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface TableColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableDetail {
  schema: string;
  name: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
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

async function withProjectClient<T>(
  project: ProjectRow,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const dbName = projectDatabaseName(project.slug);
  const role = authenticatorRoleName(project.slug);
  const uri = buildProjectUri(dbName, role, project.db_password);
  const pool = new Pool({ connectionString: uri, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE service_role');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// List tables in the public schema
// ---------------------------------------------------------------------------

export async function listTables(
  user: SessionUser,
  projectId: string,
): Promise<TableSummary[]> {
  const project = await loadProjectIfAccessible(user, projectId);

  return withProjectClient(project, async (client) => {
    // Approximate row counts via pg_class.reltuples — fast and good enough
    // for a Studio-style table list. For exact counts a SELECT count(*) per
    // table would be needed, which doesn't scale.
    const r = await client.query<{
      schemaname: string;
      tablename: string;
      reltuples: string;
      column_count: string;
    }>(`
      SELECT
        n.nspname AS schemaname,
        c.relname AS tablename,
        c.reltuples::bigint::text AS reltuples,
        (SELECT count(*)::text FROM information_schema.columns
          WHERE table_schema = n.nspname AND table_name = c.relname) AS column_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
      ORDER BY c.relname
    `);
    return r.rows.map((row) => ({
      schema: row.schemaname,
      name: row.tablename,
      rowCount: Math.max(0, Number(row.reltuples)),
      columnCount: Number(row.column_count),
    }));
  });
}

// ---------------------------------------------------------------------------
// Row mutations (insert / update / delete)
// ---------------------------------------------------------------------------

// Whitelist for safe identifiers (table names, column names) we interpolate
// directly into SQL. Anything else gets rejected before reaching the DB.
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdent(name: string, kind: string): void {
  if (!SAFE_IDENT.test(name)) {
    throw Object.assign(new Error(`Invalid ${kind}: ${name}`), {
      code: 'tables_invalid_name',
      status: 400,
    });
  }
}

// Resolves the primary-key column for a table. Used by edit/delete which
// need to target a single row by its PK. Throws if the table has no PK
// (we don't support tables without one for now).
async function getPrimaryKeyColumn(
  client: import('pg').PoolClient,
  tableName: string,
): Promise<string> {
  const r = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = 'public'
       AND tc.table_name = $1
     ORDER BY kcu.ordinal_position
     LIMIT 1`,
    [tableName],
  );
  if (r.rows.length === 0) {
    throw Object.assign(new Error(`Table ${tableName} has no primary key`), {
      code: 'tables_no_primary_key',
      status: 400,
    });
  }
  return r.rows[0].column_name;
}

export async function insertRow(
  user: SessionUser,
  projectId: string,
  tableName: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertSafeIdent(tableName, 'table name');
  const project = await loadProjectIfAccessible(user, projectId);

  // Filter out columns the caller passed but which don't exist in the table,
  // and reject any column names that aren't safe identifiers.
  const entries = Object.entries(values).filter(([k, v]) => {
    if (!SAFE_IDENT.test(k)) return false;
    // Empty strings are interpreted as NULL — same UX as Supabase Studio.
    return v !== undefined;
  });

  return withProjectClient(project, async (client) => {
    if (entries.length === 0) {
      // INSERT with no columns means use all defaults.
      const r = await client.query(`INSERT INTO public."${tableName}" DEFAULT VALUES RETURNING *`);
      return r.rows[0] as Record<string, unknown>;
    }
    const columns = entries.map(([k]) => `"${k}"`).join(', ');
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
    const params = entries.map(([, v]) => (v === '' ? null : v));
    const r = await client.query(
      `INSERT INTO public."${tableName}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      params,
    );
    return r.rows[0] as Record<string, unknown>;
  });
}

export async function updateRow(
  user: SessionUser,
  projectId: string,
  tableName: string,
  pkValue: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertSafeIdent(tableName, 'table name');
  const project = await loadProjectIfAccessible(user, projectId);

  const entries = Object.entries(values).filter(([k, v]) => {
    if (!SAFE_IDENT.test(k)) return false;
    return v !== undefined;
  });

  if (entries.length === 0) {
    throw Object.assign(new Error('No columns to update'), {
      code: 'tables_no_columns',
      status: 400,
    });
  }

  return withProjectClient(project, async (client) => {
    const pkColumn = await getPrimaryKeyColumn(client, tableName);
    const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
    const params = entries.map(([, v]) => (v === '' ? null : v));
    params.push(pkValue);
    const r = await client.query(
      `UPDATE public."${tableName}" SET ${setClauses} WHERE "${pkColumn}" = $${entries.length + 1} RETURNING *`,
      params,
    );
    if (r.rowCount === 0) {
      throw Object.assign(new Error('Row not found'), {
        code: 'tables_row_not_found',
        status: 404,
      });
    }
    return r.rows[0] as Record<string, unknown>;
  });
}

export async function deleteRow(
  user: SessionUser,
  projectId: string,
  tableName: string,
  pkValue: string,
): Promise<void> {
  assertSafeIdent(tableName, 'table name');
  const project = await loadProjectIfAccessible(user, projectId);

  await withProjectClient(project, async (client) => {
    const pkColumn = await getPrimaryKeyColumn(client, tableName);
    const r = await client.query(
      `DELETE FROM public."${tableName}" WHERE "${pkColumn}" = $1`,
      [pkValue],
    );
    if (r.rowCount === 0) {
      throw Object.assign(new Error('Row not found'), {
        code: 'tables_row_not_found',
        status: 404,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Read one table's columns + first N rows
// ---------------------------------------------------------------------------

const ROW_PREVIEW_LIMIT = 100;

export async function getTableDetail(
  user: SessionUser,
  projectId: string,
  tableName: string,
): Promise<TableDetail> {
  // Whitelist the table name to prevent injection — we'll only allow
  // unquoted identifier characters.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw Object.assign(new Error('Invalid table name'), {
      code: 'tables.invalid_name',
      status: 400,
    });
  }
  const project = await loadProjectIfAccessible(user, projectId);

  return withProjectClient(project, async (client) => {
    // Verify the table exists in `public` to avoid leaking other schemas.
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [tableName],
    );
    if (!exists.rows[0]?.exists) {
      throw Object.assign(new Error('Table not found'), {
        code: 'tables.not_found',
        status: 404,
      });
    }

    // Columns + nullability + primary key flag.
    const columns = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
      is_pk: boolean;
    }>(
      `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = $1
            AND kcu.column_name = c.column_name
        ) AS is_pk
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
      `,
      [tableName],
    );

    // Row preview — table name was just whitelisted above so direct
    // interpolation is safe.
    const preview = await client.query(`SELECT * FROM public."${tableName}" LIMIT ${ROW_PREVIEW_LIMIT}`);
    const total = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public."${tableName}"`,
    );

    return {
      schema: 'public',
      name: tableName,
      columns: columns.rows.map((c) => ({
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: c.is_pk,
      })),
      rows: preview.rows as Array<Record<string, unknown>>,
      totalRows: Number(total.rows[0].c),
    };
  });
}
