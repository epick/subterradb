'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface AuthManagerProps {
  projectId: string;
}

interface AuthUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export function AuthManager({ projectId }: AuthManagerProps) {
  const t = useTranslations('projects.auth');
  const format = useFormatter();
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/projects/${projectId}/auth/users`);
    const body = (await res.json()) as { users?: AuthUser[] };
    setUsers(body.users ?? []);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const onDelete = async (uid: string) => {
    setDeletingId(uid);
    try {
      await fetch(`/api/projects/${projectId}/auth/users/${uid}`, { method: 'DELETE' });
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-[color:var(--color-brand-from)]" />
          <h2 className="text-base font-semibold text-foreground">auth.users</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {users === null ? t('loading') : t('rowCount', { count: users.length })}
        </span>
      </header>

      {users === null ? (
        <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          {t('loading')}
        </div>
      ) : users.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          {t('noUsers')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left">{t('cols.email')}</th>
                <th className="px-5 py-3 text-left">{t('cols.created')}</th>
                <th className="px-5 py-3 text-left">{t('cols.lastSignIn')}</th>
                <th className="px-5 py-3 text-right">{t('cols.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const initials = (user.email ?? '?').slice(0, 2).toUpperCase();
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      'border-b border-border/30 transition-colors hover:bg-card/40',
                      deletingId === user.id && 'opacity-40',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="size-3 text-muted-foreground" />
                              {user.email ?? '(no email)'}
                            </span>
                          </p>
                          <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
                            {user.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {user.createdAt
                        ? format.dateTime(new Date(user.createdAt), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {user.lastSignInAt
                        ? format.relativeTime(new Date(user.lastSignInAt), {
                            now: new Date(),
                          })
                        : t('never')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(user.id)}
                        disabled={deletingId === user.id}
                        aria-label="Delete user"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                      >
                        {deletingId === user.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
