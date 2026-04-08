import { Activity, KeyRound, Server, User, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ProjectStatusBadge } from './project-status-badge';
import type { Project } from '../types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projects.card');
  const format = useFormatter();

  const lastActivity = format.relativeTime(new Date(project.lastActivityAt), {
    now: new Date(),
  });

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-from)]/40 hover:shadow-2xl hover:shadow-[color:var(--color-brand-from)]/10"
    >
      {/* Hover gradient sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-brand-from)]/0 via-transparent to-[color:var(--color-brand-to)]/0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:from-[color:var(--color-brand-from)]/[0.06] group-hover:to-[color:var(--color-brand-to)]/[0.04]"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {project.name}
          </h3>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {project.slug}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <dl className="relative grid grid-cols-2 gap-3 text-xs">
        <Stat icon={Server} label={t('services')} value="4" />
        <Stat icon={KeyRound} label={t('apiKeys')} value="2" />
        <Stat icon={Users} label={t('members')} value={String(project.membersCount ?? 0)} />
        <Stat icon={User} label={t('owner')} value={project.ownerName} />
      </dl>

      <div className="relative flex items-center gap-1.5 border-t border-border/40 pt-4 text-xs text-muted-foreground">
        <Activity className="size-3" />
        <span>
          {t('lastActivity')} {lastActivity}
        </span>
      </div>
    </Link>
  );
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2.5 py-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="truncate text-[0.65rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </dt>
        <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}
