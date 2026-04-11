'use client';

import { useState } from 'react';
import { Eye, EyeOff, Key, Shield, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CopyButton } from './copy-button';
import type { ProjectWithKeys } from './types-client';

interface ProjectApiKeysTabProps {
  project: ProjectWithKeys;
}

export function ProjectApiKeysTab({ project }: ProjectApiKeysTabProps) {
  const t = useTranslations('projects.detail.apiKeysTab');

  const keys = [
    {
      id: 'anon',
      icon: Key,
      label: t('anonKey'),
      description: t('anonKeyDescription'),
      value: project.anonKey,
      danger: false,
    },
    {
      id: 'service',
      icon: Shield,
      label: t('serviceRoleKey'),
      description: t('serviceRoleKeyDescription'),
      value: project.serviceKey,
      danger: true,
    },
    {
      id: 'jwt',
      icon: Lock,
      label: t('jwtSecret'),
      description: t('jwtSecretDescription'),
      value: project.jwtSecret,
      danger: true,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-4">
        {keys.map((key) => (
          <KeyCard key={key.id} {...key} />
        ))}
      </div>
    </section>
  );
}

function KeyCard({
  icon: Icon,
  label,
  description,
  value,
  danger,
}: {
  icon: typeof Key;
  label: string;
  description: string;
  value: string;
  danger: boolean;
}) {
  const t = useTranslations('projects.detail.apiKeysTab');
  const [revealed, setRevealed] = useState(false);

  const masked = value.slice(0, 8) + '\u2022'.repeat(20) + value.slice(-4);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
      <div className="flex items-start gap-3 p-5">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
            danger
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-border/60 bg-background/40'
          }`}
        >
          <Icon className={`size-4 ${danger ? 'text-red-400' : 'text-[color:var(--color-brand-from)]'}`} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/40 bg-background/20 px-5 py-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
          {revealed ? value : masked}
        </code>
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
