import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { restartAllProjectContainers } from '@/server/containers';

// POST /api/admin/restart-project-containers
//
// Admin-only operational endpoint. Restarts every running per-project
// container (postgrest, gotrue, storage, realtime) in place. Use this after
// the shared postgres container is recreated by an upgrade — without it,
// the per-project services keep stale TCP pools and start returning
// "broken pipe" errors on the next request.
//
// The bin/install.sh installer detects postgres recreates automatically and
// runs the equivalent restart, so this endpoint is the manual escape hatch
// for operators who upgrade by running `docker compose` directly without
// going through the installer.
//
// Response: 200 { restarted: string[], failed: Array<{name, error}> }
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ code: 'auth.forbidden' }, { status: 403 });
  }

  try {
    const result = await restartAllProjectContainers();
    return NextResponse.json({
      restarted: result.restarted,
      failed: result.failed,
      restartedCount: result.restarted.length,
      failedCount: result.failed.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'admin.restart_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
