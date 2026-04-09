// Centralized env-var access for the server runtime.
//
// Validation is lazy: each value is resolved the first time it's read, not at
// module load. That matters because `next build` imports every route file to
// collect page data, and at that point the build container does NOT have the
// real .env yet — required vars only need to exist at runtime, not build time.
//
// Notes:
//   - INTERNAL vars (databaseUrl, kongAdminUrl, kongUpstreamPlaceholder) are
//     how the GUI talks to other services on the docker network.
//   - PUBLIC vars (kongProxyUrl, publicDbHost/Port) are what we display in
//     the connection card / MCP card so developers can paste them into
//     external clients (the SDK, psql, etc.).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read the VERSION file at module load (synchronously). This is fine because
// the file is tiny and lives next to the code in both dev and the production
// Docker image. We deliberately do NOT use a getter for this — the version
// never changes during a process's lifetime.
let cachedVersion: string | null = null;
function readVersion(): string {
  if (cachedVersion !== null) return cachedVersion;
  try {
    cachedVersion = readFileSync(join(process.cwd(), 'VERSION'), 'utf8').trim();
  } catch {
    cachedVersion = 'dev';
  }
  return cachedVersion;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var ${name}. Set it in .env — see .env.example at the repo root for the canonical list, or run bin/install.sh to generate one automatically.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] && process.env[name]!.length > 0
    ? process.env[name]!
    : fallback;
}

// Lazy proxy: each property is computed on first access. We use a getter
// object instead of a Proxy so the inferred type stays clean for callers.
export const env = {
  // ----- Internal (docker network) -----
  get databaseUrl() {
    return required('SUBTERRADB_DATABASE_URL');
  },
  get kongAdminUrl() {
    return optional('KONG_ADMIN_URL', 'http://localhost:58001');
  },
  get kongUpstreamPlaceholder() {
    return optional(
      'KONG_UPSTREAM_PLACEHOLDER',
      'http://upstream-placeholder/anything',
    );
  },

  // ----- Public (shown in the GUI to developers) -----
  // Where developers' Supabase SDK clients should connect.
  get kongProxyUrl() {
    return optional('KONG_PROXY_URL', 'http://localhost:58000');
  },
  // Where developers' DB tools (psql, MCP, etc.) should connect.
  get publicDbHost() {
    return optional('SUBTERRADB_PUBLIC_DB_HOST', 'localhost');
  },
  get publicDbPort() {
    return optional('SUBTERRADB_PUBLIC_DB_PORT', '55432');
  },

  // ----- Auth -----
  get jwtSecret() {
    return required('SUBTERRADB_JWT_SECRET');
  },
  get bootstrapAdmin() {
    return {
      email: optional('SUBTERRADB_ADMIN_EMAIL', 'admin@subterra.local'),
      password: optional('SUBTERRADB_ADMIN_PASSWORD', 'subterra-admin'),
      name: optional('SUBTERRADB_ADMIN_NAME', 'SubterraDB Admin'),
    };
  },

  // ----- Build / release info -----
  // SubterraDB's own version, read from the VERSION file at the repo root
  // (or /app/VERSION inside the production image — see Dockerfile).
  get version() {
    return readVersion();
  },
};
