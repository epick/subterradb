'use client';

import { useState } from 'react';
import { Database, Eye, EyeOff, Globe, Key, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';
import type { ProjectWithKeys } from './types-client';

interface ConnectionCardProps {
  project: ProjectWithKeys;
  /** Pre-built gateway URL with the project slug appended (`${kongProxyUrl}/${slug}`). */
  projectUrl: string;
  /** Pre-built developer-facing Postgres connection URL for this project's database. */
  dbUrl: string;
}

// The single most important card on the project detail page: every value a
// developer needs to wire their app to this Supabase project.
// Each row exposes a copy button; sensitive values default to masked.
//
// projectUrl and dbUrl are computed by the parent server component
// (src/app/[locale]/(app)/projects/[id]/page.tsx) so they can read the env
// vars (KONG_PROXY_URL, SUBTERRADB_PUBLIC_DB_HOST, SUBTERRADB_PUBLIC_DB_PORT,
// POSTGRES_PASSWORD) — bin/install.sh populates those with the host's real
// public IP, so the values shown here are reachable from a developer's
// laptop, not just from the host.
export function ConnectionCard({ project, projectUrl, dbUrl }: ConnectionCardProps) {
  const t = useTranslations('projects.connection');

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>

      <div className="divide-y divide-border/40">
        <ConnectionRow icon={Globe} label={t('projectUrl')} value={projectUrl} />
        <ConnectionRow
          icon={Key}
          label={t('anonKey')}
          value={project.anonKey}
          secret
          hint={t('anonKeyHint')}
        />
        <ConnectionRow
          icon={ShieldAlert}
          label={t('serviceRoleKey')}
          value={project.serviceKey}
          secret
          danger
          hint={t('serviceRoleKeyHint')}
        />
        <ConnectionRow icon={Database} label={t('dbUrl')} value={dbUrl} secret />
      </div>
    </section>
  );
}

interface ConnectionRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  secret?: boolean;
  danger?: boolean;
  hint?: string;
}

function ConnectionRow({
  icon: Icon,
  label,
  value,
  secret = false,
  danger = false,
  hint,
}: ConnectionRowProps) {
  const t = useTranslations('projects.connection');
  const [revealed, setRevealed] = useState(!secret);

  const display = secret && !revealed ? maskValue(value) : value;

  return (
    <div className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-[10rem] items-center gap-3 sm:w-48">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40',
            danger && 'border-red-500/30 bg-red-500/5',
          )}
        >
          <Icon
            className={cn(
              'size-4',
              danger ? 'text-red-300' : 'text-[color:var(--color-brand-from)]',
            )}
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint && (
            <p
              className={cn(
                'text-[0.65rem] uppercase tracking-wider',
                danger ? 'text-red-300/80' : 'text-muted-foreground',
              )}
            >
              {hint}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <code className="block min-w-0 flex-1 truncate rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-xs text-foreground/90">
          {display}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t('hide') : t('reveal')}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <CopyButton value={value} />
      </div>
    </div>
  );
}

// Replaces the middle of a string with bullets while keeping a short prefix
// and suffix visible — same pattern Supabase Studio uses for hidden keys.
function maskValue(value: string): string {
  if (value.length <= 12) return '•'.repeat(value.length);
  return `${value.slice(0, 6)}${'•'.repeat(24)}${value.slice(-4)}`;
}
