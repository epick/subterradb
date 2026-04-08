import { useTranslations } from 'next-intl';

interface ComingSoonSectionProps {
  labelKey: string;
}

// Placeholder block reused by every settings section that isn't built yet.
export function ComingSoonSection({ labelKey }: ComingSoonSectionProps) {
  const t = useTranslations('settings');
  const tNav = useTranslations('settings.nav');

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-20 text-center backdrop-blur-xl">
      <span className="rounded-full border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-from)]">
        {t('comingSoon.kicker')}
      </span>
      <h3 className="text-lg font-semibold text-foreground">{tNav(labelKey)}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('comingSoon.description')}
      </p>
    </div>
  );
}
