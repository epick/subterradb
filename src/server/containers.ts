import Docker from 'dockerode';
import { env } from './env';

// Container orchestrator.
//
// Every project gets four dedicated containers:
//   - postgrest_{slug} (PostgREST — auto-generated REST API)
//   - gotrue_{slug}    (Supabase Auth — GoTrue)
//   - storage_{slug}   (Supabase Storage)
//   - realtime_{slug}  (Supabase Realtime)
//
// Both attach to the docker network created by docker-compose
// (`subterradb_default`) so they can resolve `subterradb-postgres` by name
// and Kong can resolve them by their container name in turn.
//
// We connect to the local Docker daemon via the standard unix socket. The
// Next.js dev server runs on the host (not inside docker), so we have direct
// access without needing to mount /var/run/docker.sock anywhere.

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// The docker-compose stack creates this network. Every dynamic container
// MUST attach to it so name-based DNS works inside the cluster.
const NETWORK_NAME = 'subterradb_default';

// Pinned image versions — change these in one place when upgrading.
// PostgREST 12 / GoTrue v2.158 / Storage v1.11 / Realtime v2.30 are the
// versions shipped by Supabase self-hosted at the time of writing.
const POSTGREST_IMAGE = 'postgrest/postgrest:v12.2.0';
const GOTRUE_IMAGE = 'supabase/gotrue:v2.158.1';
const STORAGE_IMAGE = 'supabase/storage-api:v1.11.13';
const REALTIME_IMAGE = 'supabase/realtime:v2.30.34';

// ---------------------------------------------------------------------------
// Image management
// ---------------------------------------------------------------------------

async function pullImageIfMissing(image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
    return; // already present
  } catch {
    // not present, fall through to pull
  }

  // eslint-disable-next-line no-console
  console.log(`[containers] pulling ${image}...`);
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(
        stream,
        (e) => (e ? reject(e) : resolve()),
      );
    });
  });
  // eslint-disable-next-line no-console
  console.log(`[containers] pulled ${image}`);
}

// ---------------------------------------------------------------------------
// Container helpers
// ---------------------------------------------------------------------------

interface LaunchResult {
  id: string;
  name: string;
}

export interface ProjectContainerInput {
  slug: string;
  /** The per-project Postgres database, e.g. proj_influx_web */
  databaseName: string;
  /**
   * Per-project LOGIN role (slug-prefixed) PostgREST + GoTrue + Storage connect with.
   * The shared `anon` / `authenticated` / `service_role` cluster roles are
   * GRANT'd to it so SET ROLE works at request time based on the JWT.
   */
  authenticator: string;
  /** Password for the per-project authenticator role */
  authenticatorPassword: string;
  /** JWT signing secret for this project */
  jwtSecret: string;
  /** Project anon key — Storage API needs it as an env var. */
  anonKey: string;
  /** Project service_role key — Storage API needs it as an env var. */
  serviceKey: string;
}

// Container name convention: {service}_{slug}, e.g. postgrest_my_app.
// Storage is launched per-project (rather than shared) because Supabase
// Storage isn't natively multi-tenant.
function postgrestContainerName(slug: string): string {
  return `postgrest_${slug}`;
}
function gotrueContainerName(slug: string): string {
  return `gotrue_${slug}`;
}
function storageContainerName(slug: string): string {
  return `storage_${slug}`;
}
function storageVolumeName(slug: string): string {
  return `subterradb_storage_${slug.replace(/-/g, '_')}`;
}
function realtimeContainerName(slug: string): string {
  return `realtime_${slug}`;
}

// Idempotent helper — removes a container by name, swallowing 404s.
async function removeContainerIfExists(name: string): Promise<void> {
  try {
    const c = docker.getContainer(name);
    await c.remove({ force: true });
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode !== 404) throw err;
  }
}

// ---------------------------------------------------------------------------
// PostgREST
// ---------------------------------------------------------------------------

export async function launchPostgrest(input: ProjectContainerInput): Promise<LaunchResult> {
  await pullImageIfMissing(POSTGREST_IMAGE);
  const name = postgrestContainerName(input.slug);
  await removeContainerIfExists(name);

  // PostgREST connection string uses the in-network hostname `subterradb-postgres`
  // (the docker-compose service name). The per-project authenticator role is
  // slug-prefixed for password isolation; the cluster-wide anon / authenticated
  // / service_role roles are GRANT'd to it so SET ROLE works per request.
  const dbUri = `postgres://${input.authenticator}:${encodeURIComponent(
    input.authenticatorPassword,
  )}@subterradb-postgres:5432/${input.databaseName}`;

  const container = await docker.createContainer({
    name,
    Image: POSTGREST_IMAGE,
    Env: [
      `PGRST_DB_URI=${dbUri}`,
      'PGRST_DB_SCHEMAS=public',
      // PGRST_DB_ANON_ROLE is the literal cluster-wide `anon` role, not the
      // authenticator. Same for the JWT `role` claim values.
      'PGRST_DB_ANON_ROLE=anon',
      `PGRST_JWT_SECRET=${input.jwtSecret}`,
      'PGRST_SERVER_PORT=3000',
      // Listen for NOTIFY pgrst so schema changes (CREATE TABLE, ALTER TABLE)
      // are picked up automatically without restarting the container.
      'PGRST_DB_CHANNEL_ENABLED=true',
      'PGRST_DB_CHANNEL=pgrst',
      // Speed up first cold start — PostgREST polls the schema for ~10s by default.
      'PGRST_DB_POOL=10',
    ],
    Labels: {
      'subterradb.project_slug': input.slug,
      'subterradb.role': 'postgrest',
    },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK_NAME,
    },
  });
  await container.start();
  return { id: container.id, name };
}

// ---------------------------------------------------------------------------
// GoTrue (Supabase Auth)
// ---------------------------------------------------------------------------

export async function launchGoTrue(input: ProjectContainerInput): Promise<LaunchResult> {
  await pullImageIfMissing(GOTRUE_IMAGE);
  const name = gotrueContainerName(input.slug);
  await removeContainerIfExists(name);

  // GoTrue auto-runs its migrations on startup, creating the `auth` schema
  // tables on first boot. The `search_path=auth` ensures everything lands
  // in that schema.
  const dbUri = `postgres://${input.authenticator}:${encodeURIComponent(
    input.authenticatorPassword,
  )}@subterradb-postgres:5432/${input.databaseName}?search_path=auth`;

  // Public path the gateway exposes for this project's auth API. GoTrue uses
  // these inside email links and OAuth callbacks, so they MUST be the
  // externally-reachable URLs (not localhost) — otherwise password reset
  // emails, magic links, and email confirmation links would all redirect
  // users to a non-existent localhost URL on whoever's machine receives
  // the email.
  //
  // env.kongProxyUrl comes from KONG_PROXY_URL in .env, which bin/install.sh
  // populates with the host's real public IP via `hostname -I`.
  const externalUrl = `${env.kongProxyUrl}/${input.slug}/auth/v1`;
  const siteUrl = env.kongProxyUrl;

  const container = await docker.createContainer({
    name,
    Image: GOTRUE_IMAGE,
    Env: [
      // GOTCHA: API_EXTERNAL_URL has NO `GOTRUE_` prefix — it's the only env
      // var that breaks the convention. Crash loop on first launch confirmed.
      `API_EXTERNAL_URL=${externalUrl}`,
      'GOTRUE_DB_DRIVER=postgres',
      `GOTRUE_DB_DATABASE_URL=${dbUri}`,
      `GOTRUE_JWT_SECRET=${input.jwtSecret}`,
      'GOTRUE_JWT_AUD=authenticated',
      'GOTRUE_JWT_ADMIN_ROLES=service_role',
      'GOTRUE_JWT_EXP=3600',
      'GOTRUE_API_HOST=0.0.0.0',
      'GOTRUE_API_PORT=9999',
      'GOTRUE_DISABLE_SIGNUP=false',
      `GOTRUE_SITE_URL=${siteUrl}`,
      'GOTRUE_URI_ALLOW_LIST=',
      'GOTRUE_EXTERNAL_EMAIL_ENABLED=true',
      // Mailer disabled — sign-ups are auto-confirmed and can sign in immediately.
      'GOTRUE_MAILER_AUTOCONFIRM=true',
    ],
    Labels: {
      'subterradb.project_slug': input.slug,
      'subterradb.role': 'gotrue',
    },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK_NAME,
    },
  });
  await container.start();
  return { id: container.id, name };
}

// ---------------------------------------------------------------------------
// Storage (supabase/storage-api)
// ---------------------------------------------------------------------------

// Ensures the named docker volume exists. Idempotent.
async function ensureVolume(name: string): Promise<void> {
  try {
    await docker.getVolume(name).inspect();
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) {
      await docker.createVolume({ Name: name });
    } else {
      throw err;
    }
  }
}

export async function launchStorage(input: ProjectContainerInput): Promise<LaunchResult> {
  await pullImageIfMissing(STORAGE_IMAGE);
  const name = storageContainerName(input.slug);
  const volumeName = storageVolumeName(input.slug);
  await removeContainerIfExists(name);
  await ensureVolume(volumeName);

  // Storage connects as supabase_storage_admin — the role its migrations
  // expect to own the storage schema. We pre-create that role globally in
  // ensureSharedRoles() so the vanilla postgres image works (the official
  // supabase/postgres image creates it as part of its init).
  const dbUri = `postgres://supabase_storage_admin:storage-admin@subterradb-postgres:5432/${input.databaseName}`;
  const postgrestUrl = `http://${postgrestContainerName(input.slug)}:3000`;

  const container = await docker.createContainer({
    name,
    Image: STORAGE_IMAGE,
    Env: [
      // Auth: Storage validates JWTs with the project's secret and falls back
      // to the anon/service keys for unauthenticated and admin requests.
      `ANON_KEY=${input.anonKey}`,
      `SERVICE_KEY=${input.serviceKey}`,
      `PGRST_JWT_SECRET=${input.jwtSecret}`,

      // Database: Storage runs its own migrations on first boot, creating
      // the storage schema with bucket / object / migration tables.
      // INSTALL_ROLES=false because the cluster-wide anon / authenticated /
      // service_role / supabase_storage_admin roles are pre-created by
      // ensureSharedRoles() — Storage's migration would otherwise try
      // CREATE ROLE without IF NOT EXISTS guards and crash.
      `DATABASE_URL=${dbUri}`,
      'INSTALL_ROLES=false',
      'DB_INSTALL_ROLES=false',

      // PostgREST forwarder for metadata reads.
      `POSTGREST_URL=${postgrestUrl}`,

      // File backend on a per-project named volume.
      'STORAGE_BACKEND=file',
      'FILE_STORAGE_BACKEND_PATH=/var/lib/storage',
      'FILE_SIZE_LIMIT=52428800',

      // Tenant fields are stubbed for our single-tenant-per-container model.
      'TENANT_ID=stub',
      'REGION=stub',
      'GLOBAL_S3_BUCKET=stub',

      // Disable image transformations (would need an extra imgproxy container).
      'ENABLE_IMAGE_TRANSFORMATION=false',

      // HTTP server config.
      'SERVER_PORT=5000',
      'SERVER_HOST=0.0.0.0',
    ],
    Labels: {
      'subterradb.project_slug': input.slug,
      'subterradb.role': 'storage',
    },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK_NAME,
      Binds: [`${volumeName}:/var/lib/storage`],
    },
  });
  await container.start();
  return { id: container.id, name };
}

// ---------------------------------------------------------------------------
// Realtime (supabase/realtime)
// ---------------------------------------------------------------------------

// Generates a 64-byte secret key base for Phoenix's session signing.
// Realtime crashes on startup if SECRET_KEY_BASE is shorter than 64 chars.
function generateRealtimeSecretKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 64; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function launchRealtime(input: ProjectContainerInput): Promise<LaunchResult> {
  await pullImageIfMissing(REALTIME_IMAGE);
  const name = realtimeContainerName(input.slug);
  await removeContainerIfExists(name);

  const container = await docker.createContainer({
    name,
    Image: REALTIME_IMAGE,
    Env: [
      // Direct DB access — Realtime opens a logical replication slot to
      // tail the project's WAL stream and broadcast row changes to clients.
      'DB_HOST=subterradb-postgres',
      'DB_PORT=5432',
      'DB_NAME=' + input.databaseName,
      'DB_USER=postgres',
      'DB_PASSWORD=postgres',
      'DB_AFTER_CONNECT_QUERY=SET search_path TO _realtime',
      'DB_ENC_KEY=supabaserealtime',
      'API_JWT_SECRET=' + input.jwtSecret,
      'METRICS_JWT_SECRET=' + input.jwtSecret,
      'APP_NAME=realtime',
      // Phoenix needs a 64-char secret_key_base for session signing.
      'SECRET_KEY_BASE=' + generateRealtimeSecretKey(),
      'ERL_AFLAGS=-proto_dist inet_tcp',
      'ENABLE_TAILSCALE=false',
      'DNS_NODES=localhost',
      'RLIMIT_NOFILE=10000',
      'RUN_JANITOR=true',
      'PORT=4000',
      // Single-tenant: every project gets its own Realtime container so
      // tenant_id and external_id are stub values.
      'SEED_SELF_HOST=true',
      'TENANT_ID=stub',
    ],
    Labels: {
      'subterradb.project_slug': input.slug,
      'subterradb.role': 'realtime',
    },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK_NAME,
    },
  });
  await container.start();
  return { id: container.id, name };
}

// ---------------------------------------------------------------------------
// Project lifecycle
// ---------------------------------------------------------------------------

export interface LaunchProjectContainersResult {
  postgrest: LaunchResult;
  gotrue: LaunchResult;
  storage: LaunchResult;
  realtime: LaunchResult;
}

// Every per-project container name. The pause / resume / stop helpers iterate
// this list so adding a new service only requires touching the launch+name
// functions and this array.
function projectContainerNames(slug: string): string[] {
  return [
    postgrestContainerName(slug),
    gotrueContainerName(slug),
    storageContainerName(slug),
    realtimeContainerName(slug),
  ];
}

export async function launchProjectContainers(
  input: ProjectContainerInput,
): Promise<LaunchProjectContainersResult> {
  const postgrest = await launchPostgrest(input);
  const gotrue = await launchGoTrue(input);
  const storage = await launchStorage(input);
  const realtime = await launchRealtime(input);
  return { postgrest, gotrue, storage, realtime };
}

export async function stopProjectContainers(slug: string): Promise<void> {
  for (const name of projectContainerNames(slug)) {
    await removeContainerIfExists(name);
  }
  // Also remove the per-project storage volume so a re-create starts clean.
  try {
    await docker.getVolume(storageVolumeName(slug)).remove();
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode !== 404) throw err;
  }
}

// Pause a project — stops the containers but keeps the database + Kong
// entities intact, so resuming is fast and the project's connection details
// stay the same. Returns silently for containers that are already stopped.
export async function pauseProjectContainers(slug: string): Promise<void> {
  for (const name of projectContainerNames(slug)) {
    try {
      await docker.getContainer(name).stop({ t: 5 });
    } catch (err) {
      const e = err as { statusCode?: number };
      // 304 = already stopped, 404 = no such container — both safe to ignore.
      if (e.statusCode !== 304 && e.statusCode !== 404) throw err;
    }
  }
}

// Resume a previously-paused project. Containers are restarted in place.
export async function resumeProjectContainers(slug: string): Promise<void> {
  for (const name of projectContainerNames(slug)) {
    try {
      await docker.getContainer(name).start();
    } catch (err) {
      const e = err as { statusCode?: number };
      // 304 = already running.
      if (e.statusCode !== 304 && e.statusCode !== 404) throw err;
    }
  }
}

// Restart every running per-project container in place. Used after the
// shared postgres container is recreated by an upgrade — without this, the
// per-project services (postgrest, gotrue, storage, realtime) keep their
// pools open against the OLD postgres container's TCP sockets and start
// returning "broken pipe" errors. The label `subterradb.project_slug` is
// stamped on every container at launch (see launchPostgrest / launchGoTrue
// / launchStorage / launchRealtime above), so we can find them generically
// without having to query the projects table.
export interface RestartAllResult {
  restarted: string[];
  failed: Array<{ name: string; error: string }>;
}

export async function restartAllProjectContainers(): Promise<RestartAllResult> {
  const containers = await docker.listContainers({
    all: false, // only running ones
    filters: { label: ['subterradb.project_slug'] },
  });

  const restarted: string[] = [];
  const failed: RestartAllResult['failed'] = [];

  // Sequential, not parallel — restarting too many containers at once spikes
  // postgres connection attempts and risks hitting max_connections.
  for (const c of containers) {
    const name = c.Names[0]?.replace(/^\//, '') ?? c.Id;
    try {
      await docker.getContainer(c.Id).restart({ t: 5 });
      restarted.push(name);
    } catch (err) {
      failed.push({
        name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { restarted, failed };
}

// Wait until the per-project PostgREST container is responding on its
// internal port. We probe via Kong's gateway since dockerode doesn't expose
// HTTP curls easily — the actual readiness check happens in projects.ts
// after the route is registered.
export async function isContainerRunning(name: string): Promise<boolean> {
  try {
    const info = await docker.getContainer(name).inspect();
    return info.State.Running === true;
  } catch {
    return false;
  }
}

export const containerNames = {
  postgrest: postgrestContainerName,
  gotrue: gotrueContainerName,
  storage: storageContainerName,
  realtime: realtimeContainerName,
};
