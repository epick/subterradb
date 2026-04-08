'use client';

import { ChevronRight, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';

// A breadcrumb item can either point to an i18n key from the `nav` namespace
// (for static labels like "Projects") or carry a pre-resolved label string
// (for dynamic data like project names that come from the database).
export type BreadcrumbItem = {
  labelKey?: string;
  label?: string;
  href?: string;
};

interface AppTopbarProps {
  breadcrumbs: BreadcrumbItem[];
}

// Sticky topbar shared by every (app) page. Houses the breadcrumb trail,
// global search affordance, and the language switcher.
export function AppTopbar({ breadcrumbs }: AppTopbarProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <header className="z-20 flex h-20 shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-background/70 px-6 backdrop-blur-xl">
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const text = crumb.labelKey ? t(crumb.labelKey) : (crumb.label ?? '');
          const className = isLast
            ? 'font-medium text-foreground'
            : 'text-muted-foreground transition-colors hover:text-foreground';

          return (
            <span key={`${text}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className={className}>
                  {text}
                </Link>
              ) : (
                <span className={className}>{text}</span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={tCommon('search')}
          className="hidden h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground sm:flex"
        >
          <Search className="size-3.5" />
          <span>{tCommon('search')}</span>
          <kbd className="ml-2 hidden rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[0.625rem] md:inline">
            ⌘K
          </kbd>
        </button>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
