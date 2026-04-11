'use client';

import { useState } from 'react';
import { Database, Eye, EyeOff, Table2, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CopyButton } from './copy-button';
import type { ProjectWithKeys } from './types-client';

interface ProjectDatabaseTabProps {
  project: ProjectWithKeys;
  dbUrl: string;
}

export function ProjectDatabaseTab({ project, dbUrl }: ProjectDatabaseTabProps) {
  const t = useTranslations('projects.detail.databaseTab');
  const [revealed, setRevealed] = useState(false);

  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':••••••••@');
  const dbName = `proj_${project.slug.replace(/-/g, '_')}`;
  const authenticator = `auth_${project.slug.replace(/-/g, '_')}`;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Connection string */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-start gap-3 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40">
            <Database className="size-4 text-[color:var(--color-brand-from)]" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">{t('connectionString')}</p>
            <p className="text-xs text-muted-foreground">{t('connectionStringHint')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/40 bg-background/20 px-5 py-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
            {revealed ? dbUrl : maskedUrl}
          </code>
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <CopyButton value={dbUrl} />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard label={t('databaseName')} value={dbName} mono />
        <InfoCard label={t('authenticatorRole')} value={authenticator} mono />
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t('quickLinks')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink
            href={`/projects/${project.id}/sql`}
            icon={Terminal}
            label={t('openSqlEditor')}
          />
          <QuickLink
            href={`/projects/${project.id}/tables`}
            icon={Table2}
            label={t('openTableEditor')}
          />
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xl shadow-black/30 backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Terminal; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:bg-card/80"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40">
        <Icon className="size-4 text-[color:var(--color-brand-from)]" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}
