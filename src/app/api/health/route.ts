import { NextResponse } from 'next/server';

// GET /api/health
//
// Lightweight liveness check used by:
//   - Docker HEALTHCHECK in the GUI image
//   - bin/install.sh while waiting for the stack to come up
//
// Intentionally does NOT touch the database — we just need to know that the
// Next.js process is up and serving requests. Database health is verified
// separately by postgres' own healthcheck in docker-compose.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'subterradb-gui' });
}
