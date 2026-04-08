'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { ProjectStatus } from '../types';

interface ProvisioningPollerProps {
  projectId: string;
  /** Current status as the page was rendered. We only poll while it's `provisioning`. */
  status: ProjectStatus;
}

// Tiny client-side poller that watches a project's status while it's being
// provisioned. The project detail page is a server component, so when the
// backend flips status from 'provisioning' → 'running' (or 'error') we need
// something on the client to notice and trigger a server re-render.
//
// Strategy: every 2 seconds, fetch /api/projects/[id] and check the status.
// As soon as it's no longer 'provisioning', call router.refresh() — that
// re-runs the page's server component with fresh DB data and the new status
// + connection info appears without the user having to reload.
//
// Renders nothing visible — the existing ProjectStatusBadge in the header
// already conveys "provisioning" with the warning tone + dot.
export function ProvisioningPoller({ projectId, status }: ProvisioningPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (status !== 'provisioning') return;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { project?: { status?: ProjectStatus } };
        const next = body.project?.status;
        if (!cancelled && next && next !== 'provisioning') {
          // Server-component re-render with the new status.
          router.refresh();
        }
      } catch {
        // Network blip — keep polling.
      }
    };

    const interval = setInterval(tick, 2000);
    // Kick off an immediate first poll so the UI updates fast on resume.
    void tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, status, router]);

  return null;
}
