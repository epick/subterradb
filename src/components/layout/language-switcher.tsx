'use client';

import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckItem,
} from '@/components/ui/dropdown-menu';

// Compact language switcher for the top-right of every screen.
// Uses next-intl's locale-aware router so the path keeps any deeper segments
// (e.g. /en/dashboard/projects → /es/dashboard/projects).
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const onSelect = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => {
      // next-intl's usePathname returns the locale-stripped path with dynamic
      // segments already substituted, so passing it directly preserves them.
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('label')}
          disabled={isPending}
          className="gap-2 text-foreground/70 hover:text-foreground"
        >
          <Globe className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuCheckItem
            key={loc}
            active={loc === locale}
            onSelect={() => onSelect(loc)}
          >
            <span className="text-sm">{t(loc)}</span>
            <span className="ml-auto text-xs uppercase text-muted-foreground">{loc}</span>
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
