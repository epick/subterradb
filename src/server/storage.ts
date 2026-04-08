import { query } from './db';
import { env } from './env';
import type { SessionUser } from './auth';

// Storage proxy service for the in-GUI Storage browser.
//
// We talk to the per-project Storage container through the Kong gateway
// (same path the SDK uses) so the request goes through key-auth + ACL +
// rate limiting just like a real client. The browser only ever talks to
// the Next.js API; the API talks to Storage on the user's behalf using
// the project's service_role key.

interface ProjectRow {
  id: string;
  slug: string;
  service_key: string;
}

async function loadProjectIfAccessible(
  user: SessionUser,
  projectId: string,
): Promise<ProjectRow> {
  const r = await query<ProjectRow>(
    `SELECT id, slug, service_key FROM projects WHERE id = $1`,
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

function storageBaseUrl(slug: string): string {
  return `${env.kongProxyUrl}/${slug}/storage/v1`;
}

function storageHeaders(serviceKey: string, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

export interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listBuckets(
  user: SessionUser,
  projectId: string,
): Promise<StorageBucket[]> {
  const project = await loadProjectIfAccessible(user, projectId);
  const res = await fetch(`${storageBaseUrl(project.slug)}/bucket`, {
    headers: storageHeaders(project.service_key),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw await storageError(res, 'storage.list_buckets_failed');
  }
  const body = (await res.json()) as Array<{
    id: string;
    name: string;
    public: boolean;
    created_at: string;
    updated_at: string;
  }>;
  return body.map((b) => ({
    id: b.id,
    name: b.name,
    public: b.public,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }));
}

export async function createBucket(
  user: SessionUser,
  projectId: string,
  name: string,
  isPublic: boolean,
): Promise<StorageBucket> {
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) || name.length < 3 || name.length > 63) {
    throw Object.assign(new Error('Invalid bucket name'), {
      code: 'storage.invalid_bucket_name',
      status: 400,
    });
  }
  const project = await loadProjectIfAccessible(user, projectId);
  const res = await fetch(`${storageBaseUrl(project.slug)}/bucket`, {
    method: 'POST',
    headers: storageHeaders(project.service_key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: name, name, public: isPublic }),
  });
  if (!res.ok) {
    throw await storageError(res, 'storage.create_bucket_failed');
  }
  const buckets = await listBuckets(user, projectId);
  const created = buckets.find((b) => b.name === name);
  if (!created) {
    throw Object.assign(new Error('Bucket created but not found in list'), {
      code: 'storage.bucket_not_found',
      status: 500,
    });
  }
  return created;
}

export async function deleteBucket(
  user: SessionUser,
  projectId: string,
  name: string,
): Promise<void> {
  const project = await loadProjectIfAccessible(user, projectId);

  // Empty the bucket first — Storage refuses to delete non-empty buckets.
  const objects = await listObjects(user, projectId, name, '');
  if (objects.length > 0) {
    await fetch(`${storageBaseUrl(project.slug)}/object/${name}`, {
      method: 'DELETE',
      headers: storageHeaders(project.service_key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: objects.map((o) => o.name) }),
    });
  }

  const res = await fetch(`${storageBaseUrl(project.slug)}/bucket/${name}`, {
    method: 'DELETE',
    headers: storageHeaders(project.service_key),
  });
  if (!res.ok) {
    throw await storageError(res, 'storage.delete_bucket_failed');
  }
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export interface StorageObject {
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function listObjects(
  user: SessionUser,
  projectId: string,
  bucketName: string,
  prefix: string,
): Promise<StorageObject[]> {
  const project = await loadProjectIfAccessible(user, projectId);
  // The Storage API exposes object listing via POST /object/list/{bucket}
  // with the prefix in the body.
  const res = await fetch(`${storageBaseUrl(project.slug)}/object/list/${bucketName}`, {
    method: 'POST',
    headers: storageHeaders(project.service_key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix,
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!res.ok) {
    throw await storageError(res, 'storage.list_objects_failed');
  }
  const body = (await res.json()) as Array<{
    name: string;
    metadata: { size?: number; mimetype?: string } | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  return body.map((o) => ({
    name: o.name,
    size: o.metadata?.size ?? 0,
    mimeType: o.metadata?.mimetype ?? null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  }));
}

export async function deleteObject(
  user: SessionUser,
  projectId: string,
  bucketName: string,
  objectName: string,
): Promise<void> {
  const project = await loadProjectIfAccessible(user, projectId);
  const res = await fetch(
    `${storageBaseUrl(project.slug)}/object/${bucketName}/${encodeURIComponent(objectName)}`,
    {
      method: 'DELETE',
      headers: storageHeaders(project.service_key),
    },
  );
  if (!res.ok) {
    throw await storageError(res, 'storage.delete_object_failed');
  }
}

// Stream a file body straight to Storage. The body comes from the browser
// upload via the Next.js API route, so it's already a ReadableStream / Blob.
export async function uploadObject(
  user: SessionUser,
  projectId: string,
  bucketName: string,
  objectName: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const project = await loadProjectIfAccessible(user, projectId);
  const res = await fetch(
    `${storageBaseUrl(project.slug)}/object/${bucketName}/${encodeURIComponent(objectName)}`,
    {
      method: 'POST',
      headers: storageHeaders(project.service_key, {
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      }),
      body,
    },
  );
  if (!res.ok) {
    throw await storageError(res, 'storage.upload_failed');
  }
}

// Wraps Storage error responses into our standard `code + status` shape.
async function storageError(res: Response, fallbackCode: string): Promise<Error> {
  const text = await res.text();
  return Object.assign(new Error(text || res.statusText), {
    code: fallbackCode,
    status: res.status,
  });
}
