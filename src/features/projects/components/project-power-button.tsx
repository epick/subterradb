'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface ProjectPowerButtonProps {
  projectId: string;
  status: 'running' | 'stopped' | 'provisioning' | 'error';
}

// Stop / Start toggle for a project. Calls /api/projects/[id]/stop or /start
// and refreshes the page on success so the status badge + connection card
// reflect the new state.
export function ProjectPowerButton({ projectId, status }: ProjectPowerButtonProps) {
  const t = useTranslations('projects.detail.header');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const isRunning = status === 'running';

  const onClick = async () => {
    setSubmitting(true);
    try {
      const endpoint = isRunning ? 'stop' : 'start';
      const res = await fetch(`/api/projects/${projectId}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        // Surface the error in the next render — intentionally simple.
        // eslint-disable-next-line no-console
        console.error('power toggle failed', await res.text());
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button variant="outline" size="default" onClick={onClick} disabled={submitting}>
      {submitting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isRunning ? (
        <Pause className="size-4" />
      ) : (
        <Play className="size-4" />
      )}
      {isRunning ? t('stop') : t('start')}
    </Button>
  );
}
