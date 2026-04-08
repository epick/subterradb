'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Cog,
  Database,
  Network,
  PlugZap,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { GeneralSettings } from './general-settings';
import { SecuritySettings } from './security-settings';
import { NetworkSettings } from './network-settings';
import { DangerZone } from './danger-zone';
import { ComingSoonSection } from './coming-soon-section';

type SectionKey =
  | 'general'
  | 'security'
  | 'network'
  | 'backups'
  | 'integrations'
  | 'dangerZone';

interface NavItem {
  key: SectionKey;
  icon: LucideIcon;
  danger?: boolean;
}

const NAV: NavItem[] = [
  { key: 'general', icon: Cog },
  { key: 'security', icon: ShieldAlert },
  { key: 'network', icon: Network },
  { key: 'backups', icon: Database },
  { key: 'integrations', icon: PlugZap },
  { key: 'dangerZone', icon: AlertTriangle, danger: true },
];

// Settings page composition: vertical nav on the left, active section on the
// right. Selection state is local — when the backend exists each section can
// become its own route under /settings/* if deep-linking is needed.
export function SettingsTabs() {
  const t = useTranslations('settings.nav');
  const [active, setActive] = useState<SectionKey>('general');

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav
        aria-label="Settings sections"
        className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-xl lg:w-60 lg:flex-col lg:overflow-visible lg:p-2"
      >
        {NAV.map(({ key, icon: Icon, danger }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                'group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all lg:w-full',
                isActive
                  ? danger
                    ? 'bg-red-500/10 text-red-300'
                    : 'bg-[color:var(--color-brand-from)]/10 text-foreground'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              {isActive && !danger && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-r brand-gradient shadow-[0_0_8px_var(--color-brand-from)] lg:block"
                />
              )}
              {isActive && danger && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-r bg-red-400 shadow-[0_0_8px_theme(colors.red.500)] lg:block"
                />
              )}
              <Icon
                className={cn(
                  'size-4 transition-colors',
                  isActive
                    ? danger
                      ? 'text-red-300'
                      : 'text-[color:var(--color-brand-from)]'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span>{t(key)}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 space-y-6">
        {active === 'general' && <GeneralSettings />}
        {active === 'security' && <SecuritySettings />}
        {active === 'network' && <NetworkSettings />}
        {active === 'backups' && <ComingSoonSection labelKey="backups" />}
        {active === 'integrations' && <ComingSoonSection labelKey="integrations" />}
        {active === 'dangerZone' && <DangerZone />}
      </div>
    </div>
  );
}
