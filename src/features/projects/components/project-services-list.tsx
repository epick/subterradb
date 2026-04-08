import { Cloud, Database, Lock, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProjectStatusBadge } from './project-status-badge';
import type { ProjectService, ServiceType } from '../types';

interface ProjectServicesListProps {
  services: ProjectService[];
}

const ICON_BY_TYPE: Record<ServiceType, React.ComponentType<{ className?: string }>> = {
  postgrest: Database,
  auth: Lock,
  storage: Cloud,
  realtime: Radio,
};

export function ProjectServicesList({ services }: ProjectServicesListProps) {
  const t = useTranslations('projects.services');

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('countLabel', { count: services.length })}
        </span>
      </header>

      <ul className="divide-y divide-border/40">
        {services.map((service) => {
          const Icon = ICON_BY_TYPE[service.type];
          return (
            <li
              key={service.id}
              className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40">
                  <Icon className="size-4 text-[color:var(--color-brand-from)]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{service.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {service.containerName}:{service.port}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-8">
                <ServiceMeta label={t('ram')} value={service.ramMb > 0 ? `${service.ramMb} MB` : '—'} />
                <ServiceMeta label={t('uptime')} value={service.uptime} />
                <ProjectStatusBadge status={service.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ServiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
