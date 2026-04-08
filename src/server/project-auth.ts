import { Pool } from 'pg';
import { env } from './env';
import { query } from './db';
import { projectDatabaseName } from './project-db';
import type { SessionUser } from './auth';

// Auth Manager service for the in-GUI Auth tab.
//
// Reads from the project's `auth.users` table (created by GoTrue's automatic
// migrations on first launch). All queries run as the per-project authenticator
// role with SET LOCAL ROLE service_role for full access.
//
// We don't proxy GoTrue's admin API for now — it's simpler to query the table
// directly because we own the database. When GoTrue exposes new features that
// only its admin API understands (e.g. MFA factor management) we'll switch.

interface ProjectRow {
  id: string;
  slug: string;
  db_password: string;
}

export interface ProjectAuthUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
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
// List
// ---------------------------------------------------------------------------

export async function listProjectAuthUsers(
  user: SessionUser,
  projectId: string,
): Promise<ProjectAuthUser[]> {
  const project = await loadProjectIfAccessible(user, projectId);
  return withProjectClient(project, async (client) => {
    const r = await client.query<{
      id: string;
      email: string | null;
      created_at: Date | null;
      last_sign_in_at: Date | null;
    }>(`
      SELECT id, email, created_at, last_sign_in_at
      FROM auth.users
      ORDER BY created_at DESC
      LIMIT 200
    `);
    return r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.created_at?.toISOString() ?? null,
      lastSignInAt: row.last_sign_in_at?.toISOString() ?? null,
    }));
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProjectAuthUser(
  user: SessionUser,
  projectId: string,
  userId: string,
): Promise<void> {
  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
    throw Object.assign(new Error('Invalid user id'), {
      code: 'auth.invalid_user_id',
      status: 400,
    });
  }
  const project = await loadProjectIfAccessible(user, projectId);
  await withProjectClient(project, async (client) => {
    await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
  });
}
