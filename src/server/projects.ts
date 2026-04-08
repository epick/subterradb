import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { query, withTransaction } from './db';
import { provisionProject, deprovisionProject } from './kong';
import {
  containerNames,
  launchProjectContainers,
  pauseProjectContainers,
  resumeProjectContainers,
  stopProjectContainers,
} from './containers';
import { createProjectDatabase, dropProjectDatabase } from './project-db';
import type { SessionUser } from './auth';

// Project service — handles the lifecycle of a SubterraDB project.
//
// Each project gets:
//   - A row in `projects` with its own jwt_secret + anon/service_role JWTs
//   - A Kong consumer holding both keys, attached to a per-project ACL group
//   - 4 Kong services (rest/auth/storage/realtime) + 4 routes + plugin set
//
// Each Kong service's upstream URL is set to the per-project container that
// the orchestrator just launched (postgrest_{slug}, gotrue_{slug}, etc.).

export type ProjectStatus = 'provisioning' | 'running' | 'stopped' | 'error';

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  ownerEmail: string;
  ownerName: string;
}

export interface ProjectWithKeys extends Project {
  jwtSecret: string;
  anonKey: string;
  serviceKey: string;
  dbPassword: string;
  members: Array<{ id: string; name: string; email: string }>;
}

// ---------------------------------------------------------------------------
// Slug + secret helpers
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

// Build a Supabase-compatible JWT for a per-project role.
// The plugin Kong uses (key-auth) treats these as opaque strings — they don't
// need to verify against the project's jwt_secret at the gateway. The signing
// matters only when the SDK eventually validates them downstream.
async function signProjectJwt(
  jwtSecret: string,
  projectRef: string,
  role: 'anon' | 'service_role',
): Promise<string> {
  const secretKey = new TextEncoder().encode(jwtSecret);
  const tenYears = 60 * 60 * 24 * 365 * 10;
  return new SignJWT({ role, ref: projectRef })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('subterradb')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + tenYears)
    .sign(secretKey);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  jwt_secret: string;
  anon_key: string;
  service_key: string;
  db_password: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
  };
}

// List projects visible to the given user.
// Admins see everything; developers only see projects they're a member of.
export async function listProjects(viewer: SessionUser): Promise<Project[]> {
  if (viewer.role === 'admin') {
    const result = await query<ProjectRow>(
      `SELECT p.*, u.email AS owner_email, u.name AS owner_name
       FROM projects p
       JOIN platform_users u ON u.id = p.owner_id
       ORDER BY p.created_at DESC`,
    );
    return result.rows.map(rowToProject);
  }

  const result = await query<ProjectRow>(
    `SELECT p.*, u.email AS owner_email, u.name AS owner_name
     FROM projects p
     JOIN platform_users u ON u.id = p.owner_id
     JOIN project_members m ON m.project_id = p.id
     WHERE m.user_id = $1
     ORDER BY p.created_at DESC`,
    [viewer.id],
  );
  return result.rows.map(rowToProject);
}

// Fetch a project by id, including its keys (admin or assigned dev only).
// Returns null if the viewer has no access.
export async function getProjectForViewer(
  viewer: SessionUser,
  projectId: string,
): Promise<ProjectWithKeys | null> {
  const result = await query<ProjectRow>(
    `SELECT p.*, u.email AS owner_email, u.name AS owner_name
     FROM projects p
     JOIN platform_users u ON u.id = p.owner_id
     WHERE p.id = $1`,
    [projectId],
  );
  const row = result.rows[0];
  if (!row) return null;

  if (viewer.role !== 'admin') {
    const access = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, viewer.id],
    );
    if (access.rowCount === 0) return null;
  }

  const members = await query<{ id: string; name: string; email: string }>(
    `SELECT u.id, u.name, u.email
     FROM project_members m
     JOIN platform_users u ON u.id = m.user_id
     WHERE m.project_id = $1
     ORDER BY u.name`,
    [projectId],
  );

  return {
    ...rowToProject(row),
    jwtSecret: row.jwt_secret,
    anonKey: row.anon_key,
    serviceKey: row.service_key,
    dbPassword: row.db_password,
    members: members.rows,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  slug?: string;
  dbPassword?: string;
}

export interface CreateProjectResult {
  project: Project;
  anonKey: string;
}

// createProject inserts the row in `provisioning` state and returns immediately,
// then runs the long provisioning sequence (DB + 4 containers + Kong routes)
// in the background. The caller gets back the row plus a `runProvisioning`
// promise it can fire-and-forget — the API route does NOT await it, so the
// HTTP response goes back in ~200ms instead of 20-30s. The frontend then
// navigates to the project detail page where polling shows status updates.
export async function createProject(
  owner: SessionUser,
  input: CreateProjectInput,
): Promise<CreateProjectResult & { runProvisioning: () => Promise<void> }> {
  if (owner.role !== 'admin') {
    throw Object.assign(new Error('Only admins can create projects'), {
      code: 'projects.forbidden',
      status: 403,
    });
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw Object.assign(new Error('Project name is required'), {
      code: 'projects.name_required',
      status: 400,
    });
  }

  const slug = (input.slug?.trim() && slugify(input.slug)) || slugify(trimmedName);
  if (!slug) {
    throw Object.assign(new Error('Project slug is required'), {
      code: 'projects.slug_required',
      status: 400,
    });
  }

  // Reject duplicate slugs early so we don't half-provision.
  const existing = await query(`SELECT 1 FROM projects WHERE slug = $1`, [slug]);
  if (existing.rowCount! > 0) {
    throw Object.assign(new Error('Project slug already exists'), {
      code: 'projects.slug_taken',
      status: 409,
    });
  }

  const jwtSecret = generateSecret(48);
  const dbPassword = input.dbPassword?.trim() || generateSecret(24);
  const anonKey = await signProjectJwt(jwtSecret, slug, 'anon');
  const serviceKey = await signProjectJwt(jwtSecret, slug, 'service_role');

  // 1. Insert the project row in `provisioning` state.
  const inserted = await withTransaction(async (client) => {
    const r = await client.query<ProjectRow>(
      `INSERT INTO projects (
         name, slug, status, jwt_secret, anon_key, service_key, db_password, owner_id
       ) VALUES ($1, $2, 'provisioning', $3, $4, $5, $6, $7)
       RETURNING *,
         (SELECT email FROM platform_users WHERE id = $7) AS owner_email,
         (SELECT name  FROM platform_users WHERE id = $7) AS owner_name`,
      [trimmedName, slug, jwtSecret, anonKey, serviceKey, dbPassword, owner.id],
    );
    return r.rows[0];
  });

  // 2. The long provisioning sequence — packaged as a closure so the API
  //    route can fire-and-forget it. The HTTP response goes back immediately
  //    with status='provisioning', and the frontend polls until it flips to
  //    'running' or 'error'.
  //
  //    Steps:
  //      a. CREATE DATABASE proj_{slug} + roles + base schema/extensions
  //      b. Launch the four per-project containers (postgrest, gotrue,
  //         storage, realtime)
  //      c. Register Kong services + routes pointing at the new containers
  //
  //    On any failure, mark the project as `error` and best-effort roll back
  //    everything we already created so retries start from a clean slate.
  const runProvisioning = async (): Promise<void> => {
    try {
      // a. Per-project database — creates the database, the slug-prefixed
      //    authenticator role (LOGIN), and grants it the cluster-wide anon /
      //    authenticated / service_role roles that PostgREST switches between
      //    based on the JWT's `role` claim.
      const dbInfo = await createProjectDatabase({
        slug,
        authenticatorPassword: dbPassword,
      });

      // b. Containers — uses dockerode to talk to the local Docker daemon.
      //    Launches four containers per project: postgrest + gotrue + storage
      //    + realtime. Realtime is best-effort and not blocking on failure.
      await launchProjectContainers({
        slug,
        databaseName: dbInfo.databaseName,
        authenticator: dbInfo.authenticator,
        authenticatorPassword: dbPassword,
        jwtSecret,
        anonKey,
        serviceKey,
      });

      // c. Kong, with rest + auth + storage + realtime services all pointing at
      //    the per-project containers we just launched.
      const result = await provisionProject({
        slug,
        anonKey,
        serviceKey,
        upstreams: {
          rest: `http://${containerNames.postgrest(slug)}:3000`,
          auth: `http://${containerNames.gotrue(slug)}:9999`,
          storage: `http://${containerNames.storage(slug)}:5000`,
          realtime: `http://${containerNames.realtime(slug)}:4000`,
        },
      });

      await query(
        `UPDATE projects
         SET status = 'running',
             kong_consumer_id = $1,
             kong_service_ids = $2::jsonb,
             kong_route_ids = $3::jsonb,
             last_activity_at = now()
         WHERE id = $4`,
        [
          result.consumerId,
          JSON.stringify(result.serviceIds),
          JSON.stringify(result.routeIds),
          inserted.id,
        ],
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[projects] provisioning failed for ${slug}:`, err);
      await query(`UPDATE projects SET status = 'error' WHERE id = $1`, [inserted.id]).catch(
        () => {},
      );
      // Best-effort rollback of every provisioning step.
      await deprovisionProject(slug).catch(() => {});
      await stopProjectContainers(slug).catch(() => {});
      await dropProjectDatabase(slug).catch(() => {});
    }
  };

  return {
    project: rowToProject(inserted),
    anonKey,
    runProvisioning,
  };
}

// ---------------------------------------------------------------------------
// Pause / Resume
// ---------------------------------------------------------------------------

async function fetchProjectRow(projectId: string): Promise<ProjectRow> {
  const r = await query<ProjectRow>(
    `SELECT p.*, u.email AS owner_email, u.name AS owner_name
     FROM projects p JOIN platform_users u ON u.id = p.owner_id
     WHERE p.id = $1`,
    [projectId],
  );
  const row = r.rows[0];
  if (!row) {
    throw Object.assign(new Error('Project not found'), {
      code: 'projects.not_found',
      status: 404,
    });
  }
  return row;
}

export async function pauseProject(actor: SessionUser, projectId: string): Promise<Project> {
  if (actor.role !== 'admin') {
    throw Object.assign(new Error('Only admins can stop projects'), {
      code: 'projects.forbidden',
      status: 403,
    });
  }
  const row = await fetchProjectRow(projectId);
  await pauseProjectContainers(row.slug);
  await query(`UPDATE projects SET status = 'stopped' WHERE id = $1`, [projectId]);
  return rowToProject(await fetchProjectRow(projectId));
}

export async function resumeProject(actor: SessionUser, projectId: string): Promise<Project> {
  if (actor.role !== 'admin') {
    throw Object.assign(new Error('Only admins can start projects'), {
      code: 'projects.forbidden',
      status: 403,
    });
  }
  const row = await fetchProjectRow(projectId);
  await resumeProjectContainers(row.slug);
  await query(
    `UPDATE projects SET status = 'running', last_activity_at = now() WHERE id = $1`,
    [projectId],
  );
  return rowToProject(await fetchProjectRow(projectId));
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProject(
  actor: SessionUser,
  projectId: string,
): Promise<void> {
  if (actor.role !== 'admin') {
    throw Object.assign(new Error('Only admins can delete projects'), {
      code: 'projects.forbidden',
      status: 403,
    });
  }

  const result = await query<{ slug: string }>(
    `SELECT slug FROM projects WHERE id = $1`,
    [projectId],
  );
  const row = result.rows[0];
  if (!row) {
    throw Object.assign(new Error('Project not found'), {
      code: 'projects.not_found',
      status: 404,
    });
  }

  // Tear-down sequence (reverse of provisioning):
  //   1. Stop the per-project containers so they release the database.
  //   2. Drop the per-project database + roles.
  //   3. Deprovision Kong (services + routes + plugins + consumer).
  //   4. Delete the row.
  // Each step is best-effort except the final DELETE — if Kong cleanup
  // partially fails the row sticks around so the admin can retry.
  await stopProjectContainers(row.slug).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[projects] container cleanup failed for ${row.slug}:`, e);
  });
  await dropProjectDatabase(row.slug).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[projects] database drop failed for ${row.slug}:`, e);
  });
  await deprovisionProject(row.slug);
  await query(`DELETE FROM projects WHERE id = $1`, [projectId]);
}

// ---------------------------------------------------------------------------
// Stats helper used by the dashboard
// ---------------------------------------------------------------------------

export async function getProjectStats(viewer: SessionUser): Promise<{
  total: number;
  running: number;
  stopped: number;
  errored: number;
}> {
  const projects = await listProjects(viewer);
  return {
    total: projects.length,
    running: projects.filter((p) => p.status === 'running').length,
    stopped: projects.filter((p) => p.status === 'stopped').length,
    errored: projects.filter((p) => p.status === 'error').length,
  };
}
