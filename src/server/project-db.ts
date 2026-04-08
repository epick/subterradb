import { Pool } from 'pg';
import { env } from './env';

// Per-project database initializer.
//
// Architecture (mirrors how Supabase does it under the hood):
//
//   - 3 SHARED roles at the cluster level: anon, authenticated, service_role.
//     These are NOLOGIN — they only exist to be SET ROLE'd into by PostgREST
//     based on the JWT's `role` claim. Permissions are scoped per-database
//     by GRANTs, so the same role name has different powers in each project DB.
//
//   - 1 per-project LOGIN role: auth_{slug}, holding a unique password.
//     This is what PostgREST and GoTrue connect with. It has the three shared
//     roles GRANT'd to it with NOINHERIT, so SET ROLE works at request time.
//
//   - 1 per-project database: proj_{slug}. The shared roles get USAGE on its
//     schemas + ALTER DEFAULT PRIVILEGES so future tables are visible.
//
// The design avoids the trap of slug-prefixed role names, which would force
// custom JWT claims and break the standard Supabase SDK contract.

function buildAdminUrl(): string {
  // The control-plane URL points at the subterradb_system DB; rewrite the path
  // segment to "/postgres" so we can run admin DDL.
  const url = new URL(env.databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

// Lazy admin pool — built on first use so importing this module doesn't read
// env vars (next build's page-data step has no .env present).
const globalForAdmin = globalThis as unknown as { __subterradbAdminPool?: Pool };

function getAdminPool(): Pool {
  if (globalForAdmin.__subterradbAdminPool) return globalForAdmin.__subterradbAdminPool;
  const pool = new Pool({
    connectionString: buildAdminUrl(),
    max: 4,
  });
  globalForAdmin.__subterradbAdminPool = pool;
  return pool;
}

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

// Postgres allows hyphens in identifiers only when quoted. We replace them
// with underscores so role/database names are unquoted-safe.
function safeIdentifier(slug: string): string {
  return slug.replace(/-/g, '_');
}

export function projectDatabaseName(slug: string): string {
  return `proj_${safeIdentifier(slug)}`;
}

function authenticatorRoleName(slug: string): string {
  return `auth_${safeIdentifier(slug)}`;
}

// Validates an identifier is safe for direct DDL interpolation.
// Every name we generate internally is fine; this is belt-and-suspenders.
function assertSafeIdent(name: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Shared roles bootstrap (idempotent)
// ---------------------------------------------------------------------------

// Creates the canonical Supabase roles if they don't already exist.
// Safe to call repeatedly — the DO blocks check existence first.
// We intentionally do NOT cache "already ensured" in a module-level flag
// because hot-reload in dev can leave that flag set with stale logic, and
// the idempotent SQL is cheap enough to run on every project create.
//
// Roles created:
//   - anon, authenticated, service_role         — used by PostgREST + JWT claims
//   - supabase_storage_admin                    — owner of the storage schema
//                                                 (Supabase Storage assumes it
//                                                  exists pre-migration)
async function ensureSharedRoles(): Promise<void> {
  const c = await getAdminPool().connect();
  try {
    for (const role of ['anon', 'authenticated']) {
      await c.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
            CREATE ROLE ${role} NOLOGIN NOINHERIT;
          END IF;
        END $$;
      `);
    }
    await c.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
        END IF;
      END $$;
    `);
    // supabase_storage_admin is the role Storage's migrations expect to own
    // the storage schema. The official supabase/postgres image creates it as
    // part of the image init; we mimic that here so the vanilla postgres
    // image works for our use case.
    await c.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
          CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'storage-admin'
            CREATEROLE NOREPLICATION SUPERUSER;
        END IF;
      END $$;
    `);
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------------------
// Create per-project DB
// ---------------------------------------------------------------------------

export interface CreateProjectDatabaseInput {
  slug: string;
  authenticatorPassword: string;
}

export interface ProjectDatabaseInfo {
  databaseName: string;
  /** The LOGIN role PostgREST + GoTrue connect with. */
  authenticator: string;
}

export async function createProjectDatabase(
  input: CreateProjectDatabaseInput,
): Promise<ProjectDatabaseInfo> {
  await ensureSharedRoles();

  const dbName = projectDatabaseName(input.slug);
  const authenticator = authenticatorRoleName(input.slug);
  for (const id of [dbName, authenticator]) assertSafeIdent(id);

  // CREATE DATABASE cannot run inside a transaction.
  const adminClient = await getAdminPool().connect();
  try {
    // Per-project authenticator role with the project's db_password.
    // NOINHERIT + LOGIN: PostgREST connects as this role then SET ROLE's into
    // anon / authenticated / service_role per request based on the JWT.
    const escapedPwd = input.authenticatorPassword.replace(/'/g, "''");
    await adminClient.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${authenticator}') THEN
          CREATE ROLE ${authenticator} NOINHERIT LOGIN PASSWORD '${escapedPwd}';
        END IF;
      END $$;
    `);
    // Make sure even existing roles get the password (re-runs are common in dev).
    // CREATEROLE is required because Supabase Storage creates a
    // `supabase_storage_admin` role during its bootstrap migrations.
    await adminClient.query(
      `ALTER ROLE ${authenticator} WITH LOGIN CREATEROLE PASSWORD '${escapedPwd}'`,
    );
    // Grant the three shared roles to the authenticator so it can SET ROLE.
    await adminClient.query(`GRANT anon, authenticated, service_role TO ${authenticator}`);

    // Database, owned by the authenticator so it can CREATE EXTENSION etc.
    const dbExists = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    if (dbExists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${dbName} OWNER ${authenticator}`);
    }
  } finally {
    adminClient.release();
  }

  // Connect to the new DB to install extensions and grants.
  const projectAdminUrl = buildProjectAdminUrl(dbName);
  const projectPool = new Pool({ connectionString: projectAdminUrl, max: 2 });
  try {
    const c = await projectPool.connect();
    try {
      // Required extensions.
      await c.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      await c.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      // auth schema for GoTrue, owned by the authenticator so GoTrue can DDL.
      await c.query(`CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION ${authenticator}`);

      // _realtime schema for Supabase Realtime. Its Ecto migrations need
      // the schema to exist before they can create the schema_migrations
      // table inside it. Owned by postgres (the role Realtime connects as).
      await c.query(`CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION postgres`);

      // Realtime also needs a publication on the database so it can tail
      // changes via logical replication. Create an empty one — clients can
      // ALTER PUBLICATION it later to subscribe to specific tables.
      await c.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
            CREATE PUBLICATION supabase_realtime;
          END IF;
        END $$;
      `);

      // storage schema for Supabase Storage. Owned by supabase_storage_admin
      // because Storage's migrations assume that's the schema owner.
      await c.query(`CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin`);
      // Grant the storage admin all the privileges it needs to run migrations.
      await c.query(`GRANT ALL ON DATABASE ${dbName} TO supabase_storage_admin`);
      await c.query(`GRANT ALL ON SCHEMA storage TO supabase_storage_admin`);
      // Default privileges so that any future tables Storage creates inside
      // its own schema (buckets, objects, migrations, s3_multipart_uploads…)
      // are automatically accessible to anon / authenticated / service_role.
      // Without this, the role can authenticate but every SELECT/INSERT
      // fails with "permission denied" at the table ACL level.
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
         GRANT ALL ON TABLES TO service_role`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
         GRANT SELECT ON TABLES TO anon`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
         GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role`,
      );

      // Public schema permissions for the shared roles.
      await c.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
      await c.query(`GRANT ALL ON SCHEMA public TO service_role`);
      await c.query(`GRANT CREATE ON SCHEMA public TO ${authenticator}, service_role`);

      // Default privileges so any future table created by the authenticator
      // is automatically accessible to anon/authenticated/service_role.
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA public
         GRANT ALL ON TABLES TO service_role`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA public
         GRANT SELECT ON TABLES TO anon`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role`,
      );

      // auth schema permissions (mostly for service_role to read user metadata).
      await c.query(`GRANT USAGE ON SCHEMA auth TO service_role`);
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA auth
         GRANT ALL ON TABLES TO service_role`,
      );

      // storage schema permissions — service_role needs to read buckets +
      // objects for the in-GUI Storage browser.
      await c.query(`GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role`);
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA storage
         GRANT ALL ON TABLES TO service_role`,
      );
      await c.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${authenticator} IN SCHEMA storage
         GRANT SELECT ON TABLES TO anon, authenticated`,
      );
    } finally {
      c.release();
    }
  } finally {
    await projectPool.end();
  }

  return { databaseName: dbName, authenticator };
}

// ---------------------------------------------------------------------------
// Drop per-project DB
// ---------------------------------------------------------------------------

export async function dropProjectDatabase(slug: string): Promise<void> {
  const dbName = projectDatabaseName(slug);
  const authenticator = authenticatorRoleName(slug);
  for (const id of [dbName, authenticator]) assertSafeIdent(id);

  const c = await getAdminPool().connect();
  try {
    // Kill any open connections so DROP DATABASE doesn't error out.
    await c.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await c.query(`DROP DATABASE IF EXISTS ${dbName}`);
    // The authenticator role is per-project; safe to drop now that the DB is gone.
    await c.query(`DROP ROLE IF EXISTS ${authenticator}`);
  } finally {
    c.release();
  }
}

function buildProjectAdminUrl(dbName: string): string {
  const url = new URL(env.databaseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}
