'use client';

import { Database, Network, Settings, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { SubterraDbLogo } from '@/components/brand/subterradb-logo';
import { UserMenu } from './user-menu';

// Static nav definition. Hrefs are locale-relative — the next-intl Link
// component prefixes the active locale automatically.
interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: 'projects' | 'members' | 'gateway' | 'settings';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/projects', icon: Database, labelKey: 'projects' },
  { href: '/members', icon: Users, labelKey: 'members' },
  { href: '/gateway', icon: Network, labelKey: 'gateway' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
];

interface AppSidebarProps {
  /** Authenticated user passed down from the (app) RSC layout. */
  user: {
    name: string;
    email: string;
    role: 'admin' | 'developer';
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/40 bg-background/60 backdrop-blur-xl lg:flex">
      <div className="flex h-20 items-center px-5">
        <Link href="/projects" className="flex items-center text-foreground transition hover:opacity-80">
          <SubterraDbLogo className="h-11" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-[color:var(--color-brand-from)]/10 text-foreground'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r brand-gradient shadow-[0_0_10px_var(--color-brand-from)]"
                />
              )}
              <Icon
                className={cn(
                  'size-4 transition-colors',
                  isActive
                    ? 'text-[color:var(--color-brand-from)]'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/40 p-3">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
