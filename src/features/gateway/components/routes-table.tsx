import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { GatewayRoute } from '../types';

interface RoutesTableProps {
  routes: GatewayRoute[];
}

const ROW_GRID =
  'grid grid-cols-[180px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_140px] items-center gap-4';

export function RoutesTable({ routes }: RoutesTableProps) {
  const t = useTranslations('gateway.routes');
  const format = useFormatter();
  const now = new Date();

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('countLabel', { count: routes.length })}
        </span>
      </header>

      <div className="overflow-x-auto">
        <div
          className={cn(
            ROW_GRID,
            'min-w-[940px] border-b border-border/40 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground',
          )}
        >
          <span>{t('cols.project')}</span>
          <span>{t('cols.path')}</span>
          <span>{t('cols.upstream')}</span>
          <span>{t('cols.plugins')}</span>
          <span className="text-right">{t('cols.lastSeen')}</span>
        </div>

        <ul className="min-w-[940px] divide-y divide-border/40">
          {routes.map((route) => (
            <li
              key={route.id}
              className={cn(ROW_GRID, 'px-5 py-4 transition-colors hover:bg-card/40')}
            >
              {/* Project */}
              <div className="min-w-0">
                <Link
                  href={`/projects/${route.projectId}`}
                  className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-[color:var(--color-brand-from)]"
                >
                  {route.projectName}
                </Link>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {route.projectSlug}
                </p>
              </div>

              {/* Path + methods */}
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {route.methods.map((m) => (
                    <span
                      key={m}
                      className="rounded border border-border/60 bg-background/50 px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <code className="min-w-0 truncate font-mono text-xs text-foreground/90">
                  {route.path}
                </code>
              </div>

              {/* Upstream */}
              <div className="min-w-0">
                <code className="block truncate font-mono text-xs text-foreground/90">
                  {route.upstream}
                </code>
                <p className="text-[0.65rem] text-muted-foreground">
                  :{route.upstreamPort}
                </p>
              </div>

              {/* Plugins */}
              <div className="flex min-w-0 flex-wrap gap-1">
                {route.plugins.map((p) => (
                  <Badge
                    key={p}
                    tone={p === 'rate-limiting' ? 'warning' : 'brand'}
                    className="!px-1.5 !py-0 text-[0.625rem]"
                  >
                    {p}
                  </Badge>
                ))}
              </div>

              {/* Last seen */}
              <div className="text-right text-xs text-muted-foreground">
                {format.relativeTime(new Date(route.lastSeenAt), { now })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
