// Next.js instrumentation hook — runs ONCE on server start, BEFORE the
// server begins accepting HTTP traffic.
//
// We use it to apply pending schema migrations against the control-plane
// database. If migrations fail, we throw, which causes Next.js to refuse
// to start — much better than serving requests against an inconsistent
// schema.
//
// register() is only called in the Node.js runtime (not in Edge), so the
// guard around process.env.NEXT_RUNTIME is defensive. The dynamic import
// keeps the migration code out of the Edge bundle entirely.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { runMigrations } = await import('./server/migrations');
  const { upgradeExistingProjects } = await import('./server/project-upgrades');

  try {
    const result = await runMigrations();
    if (result.applied.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[migrations] applied ${result.applied.length} new: ${result.applied.join(', ')}`,
      );
    }
    if (result.skipped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[migrations] up to date (${result.skipped.length} already applied)`,
      );
    }
    if (result.applied.length === 0 && result.skipped.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[migrations] no migration files found in db/migrations/');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[migrations] FATAL — refusing to start:', err);
    // Re-throw so Next.js aborts startup. Better to crash loudly than to
    // serve API requests with a half-applied schema.
    throw err;
  }

  // Per-project upgrades: patch existing projects with configuration fixes
  // (default privileges, Kong public storage route, etc.). Best-effort —
  // failures are logged but don't prevent startup.
  try {
    const upgraded = await upgradeExistingProjects();
    if (upgraded > 0) {
      // eslint-disable-next-line no-console
      console.log(`[project-upgrades] patched ${upgraded} existing project(s)`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[project-upgrades] non-fatal error:', err);
  }
}
