import { CalendarClock, KeyRound, Server, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ProjectWithKeys } from './types-client';

interface ProjectDetailStatsProps {
  project: ProjectWithKeys;
}

// Compact stats row used at the top of a project's overview tab.
// Mirrors the dashboard stats card style for visual consistency.
export function ProjectDetailStats({ project }: ProjectDetailStatsProps) {
  const t = useTranslations('projects.detail.stats');
  const format = useFormatter();
  const created = format.dateTime(new Date(project.createdAt), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const cards = [
    { icon: Server, label: t('services'), value: '4' },
    { icon: KeyRound, label: t('apiKeys'), value: '2' },
    { icon: Users, label: t('members'), value: String(project.members.length) },
    { icon: CalendarClock, label: t('created'), value: created },
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
              <p className="text-2xl font-bold tracking-tight text-foreground">
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
