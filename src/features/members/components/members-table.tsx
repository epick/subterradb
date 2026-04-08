import { MoreHorizontal } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RoleBadge } from './role-badge';
import type { Member } from '../types';

interface MembersTableProps {
  members: Member[];
}

// Shared grid template — keeps every row column-aligned with the header.
// CSS columns: User (flex), Role, Projects, Last active, Joined, Action.
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_140px_140px_160px_140px_44px] items-center gap-4';

export function MembersTable({ members }: MembersTableProps) {
  const t = useTranslations('members.table');
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
          {t('countLabel', { count: members.length })}
        </span>
      </header>

      {/* Wrapper handles horizontal overflow on narrow screens */}
      <div className="overflow-x-auto">
        {/* Column headers */}
        <div
          className={cn(
            ROW_GRID,
            'min-w-[820px] border-b border-border/40 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground',
          )}
        >
          <span>{t('cols.user')}</span>
          <span>{t('cols.role')}</span>
          <span>{t('cols.projects')}</span>
          <span>{t('cols.lastActive')}</span>
          <span>{t('cols.joined')}</span>
          <span aria-hidden />
        </div>

        <ul className="min-w-[820px] divide-y divide-border/40">
          {members.map((member) => {
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            const lastActive = member.lastActiveAt
              ? format.relativeTime(new Date(member.lastActiveAt), { now })
              : null;

            const joined = format.dateTime(new Date(member.joinedAt), {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <li
                key={member.id}
                className={cn(ROW_GRID, 'px-5 py-4 transition-colors hover:bg-card/40')}
              >
                {/* User column */}
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {member.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                {/* Role column */}
                <div>
                  <RoleBadge role={member.role} />
                </div>

                {/* Projects column */}
                <div>
                  {member.role === 'admin' ? (
                    <span className="text-sm text-muted-foreground">{t('allProjects')}</span>
                  ) : (
                    <span className="text-sm font-medium text-foreground">
                      {t('projectsCount', { count: member.projectsCount })}
                    </span>
                  )}
                </div>

                {/* Last active column */}
                <div>
                  {member.status === 'pending' ? (
                    <Badge tone="warning" dot>
                      {t('status.pending')}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">{lastActive}</span>
                  )}
                </div>

                {/* Joined column */}
                <div>
                  <span className="text-sm text-muted-foreground">{joined}</span>
                </div>

                {/* Action column */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    aria-label={t('actions')}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
