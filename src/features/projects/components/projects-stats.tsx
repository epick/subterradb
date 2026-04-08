import { AlertTriangle, Database, PauseCircle, PlayCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '../types';

interface ProjectsStatsProps {
  projects: Project[];
}

export function ProjectsStats({ projects }: ProjectsStatsProps) {
  const t = useTranslations('projects.stats');

  const total = projects.length;
  const running = projects.filter((p) => p.status === 'running').length;
  const stopped = projects.filter((p) => p.status === 'stopped').length;
  const errored = projects.filter((p) => p.status === 'error').length;

  const cards = [
    { icon: Database, label: t('totalProjects'), value: String(total) },
    { icon: PlayCircle, label: t('running'), value: `${running} / ${total}` },
    { icon: PauseCircle, label: t('stopped'), value: String(stopped) },
    { icon: AlertTriangle, label: t('errored'), value: String(errored) },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/30 backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {value}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40">
              <Icon className="size-4 text-[color:var(--color-brand-from)]" />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
