import { setTimeout as sleep } from 'node:timers/promises';
import { env } from './env';

// Kong 3.7.1 Admin API client.
//
// Implements the non-obvious gotchas of the Admin API in DB mode:
//
//   1. Array fields use `key[]=value` repeated N times — NOT CSV.
//   2. Long values (Supabase-style JWTs ~200+ chars) go through
//      URLSearchParams, which encodes `=`, `+`, `/` correctly.
//   3. Plugin and route creates are followed by an async router rebuild
//      that takes 1-4 seconds — callers should retry GETs if they hit
//      404 right after a create. The provisionProject helper handles this.
//   4. `key-auth` plugins set `run_on_preflight=false` so the CORS plugin
//      can intercept OPTIONS without being blocked by missing keys.
//   5. ACL plugins coexist with CORS only if the CORS plugin is also on
//      the same service (CORS priority 2000 > ACL 950 short-circuits OPTIONS).
//
// All requests use form-encoded POSTs against the Admin API on :8001.
// Errors are surfaced as KongError with the upstream HTTP status and body.

export class KongError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'KongError';
  }
}

interface KongEntity {
  id: string;
  name?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Low-level HTTP helper
// ---------------------------------------------------------------------------

async function kongRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: URLSearchParams,
): Promise<unknown> {
  const url = `${env.kongAdminUrl}${path}`;
  const init: RequestInit = {
    method,
    headers: body
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : undefined,
    body: body?.toString(),
  };

  const res = await fetch(url, init);

  // 204 No Content (deletes) — nothing to parse.
  if (res.status === 204) return null;

  const text = await res.text();
  if (!res.ok) {
    throw new KongError(
      `Kong ${method} ${path} failed with ${res.status}`,
      res.status,
      text,
    );
  }
  return text.length > 0 ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Form encoding helper — handles arrays via repeated `key[]=` entries
// ---------------------------------------------------------------------------

function formData(fields: Record<string, string | number | boolean | string[]>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      // Spike gotcha #1: arrays must be repeated `key[]=value` entries.
      for (const v of value) {
        params.append(`${key}[]`, v);
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getKongStatus(): Promise<{
  reachable: boolean;
  version?: string;
}> {
  try {
    const status = (await kongRequest('GET', '/status')) as { server: unknown } | null;
    const root = (await kongRequest('GET', '/')) as { version?: string };
    return { reachable: !!status, version: root.version };
  } catch {
    return { reachable: false };
  }
}

// ---------------------------------------------------------------------------
// Services + Routes
// ---------------------------------------------------------------------------

export interface CreateServiceInput {
  name: string;
  url: string;
}

export async function createService(input: CreateServiceInput): Promise<KongEntity> {
  return kongRequest(
    'POST',
    '/services',
    formData({ name: input.name, url: input.url }),
  ) as Promise<KongEntity>;
}

export async function deleteServiceByName(name: string): Promise<void> {
  // Cascade-delete the routes, then the service itself.
  try {
    const routes = (await kongRequest('GET', `/services/${name}/routes`)) as {
      data: KongEntity[];
    };
    for (const route of routes.data ?? []) {
      await kongRequest('DELETE', `/routes/${route.id}`);
    }
    const plugins = (await kongRequest('GET', `/services/${name}/plugins`)) as {
      data: KongEntity[];
    };
    for (const plugin of plugins.data ?? []) {
      await kongRequest('DELETE', `/plugins/${plugin.id}`);
    }
    await kongRequest('DELETE', `/services/${name}`);
  } catch (err) {
    if (err instanceof KongError && err.status === 404) return;
    throw err;
  }
}

export interface CreateRouteInput {
  serviceName: string;
  routeName: string;
  paths: string[];
  methods?: string[];
}

export async function createRoute(input: CreateRouteInput): Promise<KongEntity> {
  return kongRequest(
    'POST',
    `/services/${input.serviceName}/routes`,
    formData({
      name: input.routeName,
      paths: input.paths,
      ...(input.methods ? { methods: input.methods } : {}),
    }),
  ) as Promise<KongEntity>;
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

export async function enableKeyAuthPlugin(serviceName: string): Promise<KongEntity> {
  // Spike gotcha #3: run_on_preflight=false so the CORS plugin can handle OPTIONS.
  return kongRequest(
    'POST',
    `/services/${serviceName}/plugins`,
    formData({
      name: 'key-auth',
      'config.key_names': ['apikey'],
      'config.run_on_preflight': false,
    }),
  ) as Promise<KongEntity>;
}

export async function enableCorsPlugin(serviceName: string): Promise<KongEntity> {
  return kongRequest(
    'POST',
    `/services/${serviceName}/plugins`,
    formData({
      name: 'cors',
      'config.origins': ['*'],
      'config.methods': ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      'config.credentials': false,
    }),
  ) as Promise<KongEntity>;
}

export async function enableAclPlugin(
  serviceName: string,
  allowGroup: string,
): Promise<KongEntity> {
  return kongRequest(
    'POST',
    `/services/${serviceName}/plugins`,
    formData({
      name: 'acl',
      'config.allow': [allowGroup],
    }),
  ) as Promise<KongEntity>;
}

export async function enableRequestTransformerPlugin(
  serviceName: string,
  addHeaders: string[],
): Promise<KongEntity> {
  // Spike gotcha #1: array fields use `key[]=` syntax, not CSV.
  return kongRequest(
    'POST',
    `/services/${serviceName}/plugins`,
    formData({
      name: 'request-transformer',
      'config.add.headers': addHeaders,
    }),
  ) as Promise<KongEntity>;
}

// ---------------------------------------------------------------------------
// Consumers + key-auth credentials
// ---------------------------------------------------------------------------

export async function createConsumer(username: string): Promise<KongEntity> {
  return kongRequest(
    'POST',
    '/consumers',
    formData({ username }),
  ) as Promise<KongEntity>;
}

export async function deleteConsumerByName(username: string): Promise<void> {
  try {
    await kongRequest('DELETE', `/consumers/${username}`);
  } catch (err) {
    if (err instanceof KongError && err.status === 404) return;
    throw err;
  }
}

export async function provisionConsumerKey(
  username: string,
  key: string,
): Promise<KongEntity> {
  // Spike gotcha #2: long JWT-shaped keys must use proper URL encoding,
  // which URLSearchParams handles automatically.
  return kongRequest(
    'POST',
    `/consumers/${username}/key-auth`,
    formData({ key }),
  ) as Promise<KongEntity>;
}

export async function addConsumerToAclGroup(
  username: string,
  group: string,
): Promise<KongEntity> {
  return kongRequest(
    'POST',
    `/consumers/${username}/acls`,
    formData({ group }),
  ) as Promise<KongEntity>;
}

// ---------------------------------------------------------------------------
// High-level: provision a full project (4 services + 4 routes + plugins + consumer)
// ---------------------------------------------------------------------------

export type ProjectServiceType = 'rest' | 'auth' | 'storage' | 'realtime';

const SERVICE_PATHS: Record<ProjectServiceType, string> = {
  rest: '/rest/v1',
  auth: '/auth/v1',
  storage: '/storage/v1',
  realtime: '/realtime/v1',
};

const PROJECT_SERVICES: ProjectServiceType[] = ['rest', 'auth', 'storage', 'realtime'];

export interface ProvisionProjectInput {
  slug: string;
  anonKey: string;
  serviceKey: string;
  /**
   * Per-service upstream URLs pointing at the dynamically-launched per-project
   * containers. Missing entries fall back to a shared placeholder upstream so
   * the gateway routes still resolve.
   */
  upstreams?: Partial<Record<ProjectServiceType, string>>;
}

export interface ProvisionProjectResult {
  consumerId: string;
  serviceIds: Record<ProjectServiceType, string>;
  routeIds: Record<ProjectServiceType, string>;
}

export async function provisionProject(
  input: ProvisionProjectInput,
): Promise<ProvisionProjectResult> {
  const { slug, anonKey, serviceKey, upstreams = {} } = input;
  const aclGroup = `proj_${slug}`;
  const consumerName = `consumer_${slug}`;

  // 1. Create the consumer (one per project, holds both anon + service_role keys).
  const consumer = await createConsumer(consumerName);
  await provisionConsumerKey(consumerName, anonKey);
  await provisionConsumerKey(consumerName, serviceKey);
  await addConsumerToAclGroup(consumerName, aclGroup);

  const serviceIds = {} as Record<ProjectServiceType, string>;
  const routeIds = {} as Record<ProjectServiceType, string>;

  // 2. Create one Kong service + one route per Supabase service type.
  //    Each route points at its corresponding per-project container.
  for (const type of PROJECT_SERVICES) {
    const serviceName = `${type}_${slug}`;
    const routeName = `${type}_${slug}_route`;
    const publicPath = `/${slug}${SERVICE_PATHS[type]}`;
    const upstreamUrl = upstreams[type] ?? env.kongUpstreamPlaceholder;

    const service = await createService({
      name: serviceName,
      url: upstreamUrl,
    });
    serviceIds[type] = service.id;

    const route = await createRoute({
      serviceName,
      routeName,
      paths: [publicPath],
    });
    routeIds[type] = route.id;

    // Plugin order matters less here because Kong dispatches by priority,
    // but creating CORS first avoids the brief window where ACL would
    // 401 the preflight.
    await enableCorsPlugin(serviceName);
    await enableKeyAuthPlugin(serviceName);
    await enableAclPlugin(serviceName, aclGroup);
    await enableRequestTransformerPlugin(serviceName, [`X-SubterraDB-Project:${slug}`]);
  }

  // 2b. Public storage route — serves /{slug}/storage/v1/object/public/*
  //     without key-auth so public bucket URLs work like Supabase Cloud.
  //     Kong matches the longer path first, so this wins over the general
  //     storage route above.
  await provisionPublicStorageRoute(slug, upstreams);

  // 3. Wait for Kong's router to pick up the new routes.
  //    Spike gotcha #5: rebuild is async; poll a known route until it answers.
  const probePath = `/${slug}${SERVICE_PATHS.rest}/_subterradb_probe`;
  await waitForRouterReady(probePath, anonKey);

  return { consumerId: consumer.id, serviceIds, routeIds };
}

export async function deprovisionProject(slug: string): Promise<void> {
  // Reverse order: services + routes + plugins, then consumer.
  for (const type of PROJECT_SERVICES) {
    await deleteServiceByName(`${type}_${slug}`);
  }
  // Clean up the public-storage service if it exists.
  await deleteServiceByName(publicStorageServiceName(slug));
  await deleteConsumerByName(`consumer_${slug}`);
}

// ---------------------------------------------------------------------------
// Public storage route (no auth required)
// ---------------------------------------------------------------------------

function publicStorageServiceName(slug: string): string {
  return `storage_public_${slug}`;
}

/**
 * Creates a Kong service + route for /{slug}/storage/v1/object/public that
 * has CORS but NO key-auth / ACL, so public bucket URLs work without an
 * apikey — matching Supabase Cloud behaviour.
 */
export async function provisionPublicStorageRoute(
  slug: string,
  upstreams: Partial<Record<ProjectServiceType, string>> = {},
): Promise<void> {
  const serviceName = publicStorageServiceName(slug);
  const routeName = `${serviceName}_route`;
  const publicPath = `/${slug}/storage/v1/object/public`;
  const baseUpstream = upstreams.storage ?? env.kongUpstreamPlaceholder;

  // Kong strip_path=true (default) removes the matched route prefix before
  // forwarding. For a request to /{slug}/storage/v1/object/public/bucket/file,
  // Kong strips /{slug}/storage/v1/object/public and sends /bucket/file to the
  // upstream. The Storage API expects /object/public/bucket/file, so we bake
  // /object/public into the service URL to compensate.
  const upstreamUrl = baseUpstream.replace(/\/$/, '') + '/object/public';

  await createService({ name: serviceName, url: upstreamUrl });
  await createRoute({ serviceName, routeName, paths: [publicPath] });
  await enableCorsPlugin(serviceName);
  await enableRequestTransformerPlugin(serviceName, [`X-SubterraDB-Project:${slug}`]);
}

// ---------------------------------------------------------------------------
// Router-rebuild poller
// ---------------------------------------------------------------------------

async function waitForRouterReady(path: string, apiKey: string): Promise<void> {
  // We expect a 401 (no key) or 200 (key matched) — anything that proves the
  // route exists. A 404 means the router is still rebuilding.
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${env.kongProxyUrl}${path}`, {
        headers: { apikey: apiKey },
      });
      if (res.status !== 404) return;
    } catch {
      // Network blip — try again.
    }
    await sleep(1000);
  }
  // Don't throw — if we got this far the routes were created successfully,
  // the router is just slow. Project will be reachable shortly.
}
