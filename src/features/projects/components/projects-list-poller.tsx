'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { ProjectStatus } from '../types';

interface ProjectsListPollerProps {
  /** Statuses as the page was rendered server-side. */
  statuses: ReadonlyArray<ProjectStatus>;
}

// Watches the projects list page. While at least one project is in
// `provisioning` state, polls /api/projects every 2 seconds and calls
// router.refresh() as soon as the set of provisioning projects shrinks
// (i.e. one of them flipped to `running` or `error`).
//
// Renders nothing — the existing ProjectStatusBadge inside each card
// reflects the new status after the server-component re-render.
export function ProjectsListPoller({ statuses }: ProjectsListPollerProps) {
  const router = useRouter();
  const provisioningCount = statuses.filter((s) => s === 'provisioning').length;

  useEffect(() => {
    if (provisioningCount === 0) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/projects', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { projects?: Array<{ status: ProjectStatus }> };
        const stillProvisioning = (body.projects ?? []).filter(
          (p) => p.status === 'provisioning',
        ).length;
        if (!cancelled && stillProvisioning < provisioningCount) {
          // At least one project finished — re-render the server component.
          router.refresh();
        }
      } catch {
        // Network blip — keep polling.
      }
    };

    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [provisioningCount, router]);

  return null;
}
