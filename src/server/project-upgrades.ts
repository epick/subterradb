// Per-project upgrade hooks — run at server start (from instrumentation.ts)
// AFTER control-plane migrations complete.
//
// These fix configuration gaps in existing projects that were provisioned
// before a bug was discovered. Each hook is idempotent so running it on a
// project that already has the fix is a harmless no-op.

import Docker from 'dockerode';
import { Pool } from 'pg';
import { env } from './env';
import { query } from './db';
import {
  provisionPublicStorageRoute,
  KongError,
} from './kong';
import { containerNames, launchPostgrest } from './containers';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

interface ProjectRow {
  slug: string;
  db_password: string;
  jwt_secret: string;
  anon_key: string;
  service_key: string;
  status: string;
}

function safeIdentifier(slug: string): string {
  return slug.replace(/-/g, '_');
}

function authenticatorRoleName(slug: string): string {
  return `auth_${safeIdentifier(slug)}`;
}

function projectDatabaseName(slug: string): string {
  return `proj_${safeIdentifier(slug)}`;
}

function buildProjectAdminUrl(dbName: string): string {
  const url = new URL(env.databaseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

// ---------------------------------------------------------------------------
// Fix 1: ALTER DEFAULT PRIVILEGES for service_role + postgres
// ---------------------------------------------------------------------------

async function fixDefaultPrivileges(slug: string): Promise<void> {
  const dbName = projectDatabaseName(slug);
  const authenticator = authenticatorRoleName(slug);
  const pool = new Pool({ connectionString: buildProjectAdminUrl(dbName), max: 1 });
  try {
    const c = await pool.connect();
    try {
      for (const creator of [authenticator, 'service_role', 'postgres']) {
        await c.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${creator} IN SCHEMA public
           GRANT ALL ON TABLES TO service_role`,
        );
        await c.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${creator} IN SCHEMA public
           GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated`,
        );
        await c.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${creator} IN SCHEMA public
           GRANT SELECT ON TABLES TO anon`,
        );
        await c.query(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${creator} IN SCHEMA public
           GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role`,
        );
      }
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Fix 2: Recreate PostgREST container with schema-reload env vars
// ---------------------------------------------------------------------------

async function fixPostgrestSchemaReload(project: ProjectRow): Promise<void> {
  const name = containerNames.postgrest(project.slug);

  // Check if the existing container already has the channel config.
  // If it does, skip — no need to recreate on every restart.
  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();
    const envVars = info.Config.Env ?? [];
    if (envVars.some((e: string) => e.startsWith('PGRST_DB_CHANNEL_ENABLED='))) {
      return; // already patched
    }
  } catch {
    // Container doesn't exist — launchPostgrest will create it.
  }

  const authenticator = authenticatorRoleName(project.slug);
  const dbName = projectDatabaseName(project.slug);

  await launchPostgrest({
    slug: project.slug,
    databaseName: dbName,
    authenticator,
    authenticatorPassword: project.db_password,
    jwtSecret: project.jwt_secret,
    anonKey: project.anon_key,
    serviceKey: project.service_key,
  });
  // eslint-disable-next-line no-console
  console.log(`[project-upgrades] recreated PostgREST container ${name} with schema-reload config`);
}

// ---------------------------------------------------------------------------
// Fix 3: Kong public storage route (no key-auth)
// ---------------------------------------------------------------------------

async function fixPublicStorageRoute(slug: string): Promise<void> {
  try {
    await provisionPublicStorageRoute(slug, {
      storage: `http://${containerNames.storage(slug)}:5000`,
    });
  } catch (err) {
    // 409 = already exists (idempotent). Anything else is a real error.
    if (err instanceof KongError && err.status === 409) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function upgradeExistingProjects(): Promise<number> {
  const result = await query<ProjectRow>(
    `SELECT slug, db_password, jwt_secret, anon_key, service_key, status
     FROM projects WHERE status = 'running'`,
  );
  const projects = result.rows;
  if (projects.length === 0) return 0;

  let upgraded = 0;
  for (const project of projects) {
    try {
      await fixDefaultPrivileges(project.slug);
      await fixPostgrestSchemaReload(project);
      await fixPublicStorageRoute(project.slug);
      upgraded++;
    } catch (err) {
      // Log but don't crash the server — best-effort for each project.
      // eslint-disable-next-line no-console
      console.warn(
        `[project-upgrades] failed for ${project.slug}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return upgraded;
}
