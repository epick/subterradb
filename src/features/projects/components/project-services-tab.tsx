'use client';

import { useEffect, useState } from 'react';
import { Box, CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ContainerInfo } from '@/server/containers';

interface ProjectServicesTabProps {
  projectId: string;
}

export function ProjectServicesTab({ projectId }: ProjectServicesTabProps) {
  const t = useTranslations('projects.detail.services');
  const [services, setServices] = useState<ContainerInfo[] | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/services`)
      .then((r) => r.json())
      .then((data) => setServices(data.services ?? []))
      .catch(() => setServices([]));
  }, [projectId]);

  if (!services) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((svc) => (
          <div
            key={svc.type}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/30 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Box className="size-4 text-[color:var(--color-brand-from)]" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(`types.${svc.type}`)}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(`descriptions.${svc.type}`)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {svc.running ? (
                  <>
                    <CircleCheck className="size-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">{t('running')}</span>
                  </>
                ) : (
                  <>
                    <CircleX className="size-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">{t('stopped')}</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-1.5 rounded-lg border border-border/40 bg-background/30 p-3">
              <InfoRow label={t('image')} value={svc.image || '—'} mono />
              <InfoRow label={t('container')} value={svc.name} mono />
              <InfoRow label={t('port')} value={String(svc.port)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
