import { Activity, Network, Plug, Route } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

interface GatewayStatsProps {
  stats: {
    services: number;
    routes: number;
    plugins: number;
    requestsPerHour: number;
  };
}

export function GatewayStats({ stats }: GatewayStatsProps) {
  const t = useTranslations('gateway.stats');
  const format = useFormatter();

  const cards = [
    { icon: Network, label: t('services'), value: String(stats.services) },
    { icon: Route, label: t('routes'), value: String(stats.routes) },
    { icon: Plug, label: t('plugins'), value: String(stats.plugins) },
    {
      icon: Activity,
      label: t('requests'),
      value: format.number(stats.requestsPerHour, { notation: 'compact' }),
    },
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
