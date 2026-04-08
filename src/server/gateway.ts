import { env } from './env';
import type { GatewayPlugin, GatewayRoute } from '@/features/gateway/types';

// Gateway service — reads live state from the Kong Admin API and shapes it
// for the Gateway dashboard.
//
// Kong's Admin API exposes /services, /routes, /plugins, /consumers as
// paginated endpoints. For Phase 0 we trust that the data set fits in one
// page (we have at most a few dozen routes); a real deployment would need
// pagination handling.

interface KongService {
  id: string;
  name: string;
  host: string;
  port: number;
  path?: string | null;
  created_at: number;
  updated_at: number;
}

interface KongRoute {
  id: string;
  name: string;
  paths: string[];
  methods: string[] | null;
  service: { id: string };
  created_at: number;
  updated_at: number;
}

interface KongPlugin {
  id: string;
  name: string;
  service?: { id: string } | null;
  route?: { id: string } | null;
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.kongAdminUrl}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Kong Admin API ${path} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

const KNOWN_PLUGINS: GatewayPlugin[] = [
  'key-auth',
  'cors',
  'acl',
  'request-transformer',
  'rate-limiting',
];

function isKnownPlugin(name: string): name is GatewayPlugin {
  return (KNOWN_PLUGINS as string[]).includes(name);
}

// Map a Kong service name like `rest_influx-web` back to project info.
// We rely on the convention `<type>_<slug>` enforced by provisionProject().
function parseServiceName(name: string): { slug: string; type: string } | null {
  const idx = name.indexOf('_');
  if (idx <= 0) return null;
  const type = name.slice(0, idx);
  const slug = name.slice(idx + 1);
  return { slug, type };
}

export async function getGatewaySnapshot(): Promise<{
  routes: GatewayRoute[];
  stats: {
    services: number;
    routes: number;
    plugins: number;
    requestsPerHour: number;
  };
}> {
  const [services, routes, plugins] = await Promise.all([
    adminGet<{ data: KongService[] }>('/services'),
    adminGet<{ data: KongRoute[] }>('/routes'),
    adminGet<{ data: KongPlugin[] }>('/plugins'),
  ]);

  const serviceById = new Map<string, KongService>(services.data.map((s) => [s.id, s]));

  // Group plugins by serviceId so we can attach plugin names to each route.
  const pluginsByService = new Map<string, GatewayPlugin[]>();
  for (const p of plugins.data) {
    if (!p.service) continue;
    if (!isKnownPlugin(p.name)) continue;
    const list = pluginsByService.get(p.service.id) ?? [];
    if (!list.includes(p.name)) list.push(p.name);
    pluginsByService.set(p.service.id, list);
  }

  // Filter to per-project routes only — those whose service follows the
  // `<type>_<slug>` naming convention. Anything else is system noise.
  const gatewayRoutes: GatewayRoute[] = [];
  for (const r of routes.data) {
    const service = serviceById.get(r.service.id);
    if (!service) continue;
    const parsed = parseServiceName(service.name);
    if (!parsed) continue;

    gatewayRoutes.push({
      id: r.id,
      projectId: parsed.slug,
      projectName: humanizeSlug(parsed.slug),
      projectSlug: parsed.slug,
      upstream: service.name,
      upstreamPort: service.port,
      path: r.paths[0] ?? '',
      methods: r.methods ?? ['GET', 'POST', 'PATCH', 'DELETE'],
      plugins: pluginsByService.get(service.id) ?? [],
      lastSeenAt: new Date(r.updated_at * 1000).toISOString(),
    });
  }

  // Sort by project then by service type for stable rendering.
  gatewayRoutes.sort((a, b) => {
    if (a.projectSlug !== b.projectSlug) return a.projectSlug.localeCompare(b.projectSlug);
    return a.upstream.localeCompare(b.upstream);
  });

  // Total active plugins (only counting plugins attached to per-project services).
  const projectServiceIds = new Set(
    services.data
      .filter((s) => parseServiceName(s.name) !== null)
      .map((s) => s.id),
  );
  const totalPlugins = plugins.data.filter(
    (p) => p.service && projectServiceIds.has(p.service.id) && isKnownPlugin(p.name),
  ).length;

  return {
    routes: gatewayRoutes,
    stats: {
      services: projectServiceIds.size,
      routes: gatewayRoutes.length,
      plugins: totalPlugins,
      // We don't have real request metrics yet — show 0 until Phase 2 hooks
      // up Vector / Logflare. The dashboard label still reads "Requests / hour".
      requestsPerHour: 0,
    },
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}
