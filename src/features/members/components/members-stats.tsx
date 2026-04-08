import { Clock, ShieldCheck, Users, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Member } from '../types';

interface MembersStatsProps {
  members: Member[];
}

export function MembersStats({ members }: MembersStatsProps) {
  const t = useTranslations('members.stats');

  const total = members.length;
  const admins = members.filter((m) => m.role === 'admin').length;
  const developers = members.filter((m) => m.role === 'developer').length;
  const pending = members.filter((m) => m.status === 'pending').length;

  const cards = [
    { icon: Users, label: t('total'), value: String(total) },
    { icon: ShieldCheck, label: t('admins'), value: String(admins) },
    { icon: Wrench, label: t('developers'), value: String(developers) },
    { icon: Clock, label: t('pending'), value: String(pending) },
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
              <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
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
