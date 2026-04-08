// Domain types for the Kong gateway view.
// Each project registers ~4 services with Kong; each service exposes one
// or more routes; each route has a set of plugins applied to it.
export type GatewayPlugin =
  | 'key-auth'
  | 'cors'
  | 'acl'
  | 'request-transformer'
  | 'rate-limiting';

export interface GatewayRoute {
  id: string;
  /** Owning project — used to group routes by project. */
  projectId: string;
  projectName: string;
  projectSlug: string;
  /** Service the route forwards to (e.g. "auth_influx-web"). */
  upstream: string;
  upstreamPort: number;
  /** Public path the route matches under the project namespace. */
  path: string;
  methods: string[];
  plugins: GatewayPlugin[];
  /** ISO timestamp of the last request that hit this route. */
  lastSeenAt: string;
}
