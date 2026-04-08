import { Database, FileCode, FileText, Package, ScrollText, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface ProjectQuickActionsProps {
  projectId: string;
}

// Quick-action cards on the project's overview tab. Each one opens an
// in-GUI tool that lets devs interact with the project's per-project
// Postgres database without leaving SubterraDB.
export function ProjectQuickActions({ projectId }: ProjectQuickActionsProps) {
  const t = useTranslations('projects.quickActions');

  const actions = [
    { key: 'sql' as const, icon: FileCode, href: `/projects/${projectId}/sql` },
    { key: 'tables' as const, icon: Database, href: `/projects/${projectId}/tables` },
    { key: 'auth' as const, icon: Users, href: `/projects/${projectId}/auth` },
    { key: 'storage' as const, icon: Package, href: `/projects/${projectId}/storage` },
    { key: 'logs' as const, icon: ScrollText, href: `/projects/${projectId}/logs` },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {actions.map(({ key, icon: Icon, href }) => (
        <Link
          key={key}
          href={href}
          className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-from)]/40 hover:shadow-2xl hover:shadow-[color:var(--color-brand-from)]/10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-brand-from)]/0 to-[color:var(--color-brand-to)]/0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:from-[color:var(--color-brand-from)]/[0.06] group-hover:to-[color:var(--color-brand-to)]/[0.04]"
          />
          <span className="relative flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40">
            <Icon className="size-4 text-[color:var(--color-brand-from)]" />
          </span>
          <div className="relative space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{t(`${key}.title`)}</h3>
            <p className="text-xs text-muted-foreground">{t(`${key}.description`)}</p>
          </div>
        </Link>
      ))}
    </section>
  );
}
