// Domain types for SubterraDB projects.
// Mirrors the shape returned by the /api/projects endpoint, which itself
// comes from src/server/projects.ts.

export type ProjectStatus = 'running' | 'stopped' | 'provisioning' | 'error';

export interface Project {
  id: string;
  name: string;
  /** URL-safe identifier used for the public path prefix and container names. */
  slug: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  ownerEmail: string;
  ownerName: string;
  /** Number of project members assigned (developers). Optional in list views. */
  membersCount?: number;
}

export type ServiceType = 'postgrest' | 'auth' | 'storage' | 'realtime';

export interface ProjectService {
  id: string;
  type: ServiceType;
  /** Human-readable display name, e.g. "PostgREST" or "Auth (GoTrue)". */
  name: string;
  status: ProjectStatus;
  /** Docker container name on the host VM, e.g. "postgrest_influx-web". */
  containerName: string;
  /** Internal port the upstream container listens on. */
  port: number;
  ramMb: number;
  /** Human-formatted uptime, e.g. "5d 3h". Mock-only; the backend will return a timestamp. */
  uptime: string;
}
