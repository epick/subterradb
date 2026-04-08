import { Layers, Feather, Plug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SubterraDbLogo } from '@/components/brand/subterradb-logo';

// Marketing-style hero panel rendered on the aside of the login screen.
// Pure presentational — no data, no state. Designed to be swapped easily
// for any other content (illustration, video, testimonial, etc.) on a per-page basis.
export function LoginHero() {
  const t = useTranslations('auth.signIn.hero');

  const features = [
    { icon: Layers, key: 'multiProject' as const },
    { icon: Feather, key: 'lightweight' as const },
    { icon: Plug, key: 'dropIn' as const },
  ];

  return (
    <div className="relative flex h-full w-full max-w-xl flex-col justify-center">
      {/* Decorative oversized logo glyph in the bottom-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 opacity-[0.06] mix-blend-screen"
      >
        <SubterraDbLogo iconOnly className="h-[26rem] w-auto" />
      </div>

      <div className="relative space-y-8">
        {/* Kicker pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10 px-3.5 py-1.5">
          <span className="size-1.5 rounded-full bg-[color:var(--color-brand-from)] shadow-[0_0_8px_var(--color-brand-from)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-from)]">
            {t('kicker')}
          </span>
        </div>

        {/* Headline with rich-text accent */}
        <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
          {t.rich('headline', {
            accent: (chunks) => (
              <span className="brand-gradient-text">{chunks}</span>
            ),
          })}
        </h1>

        {/* Subtitle */}
        <p className="max-w-lg text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t('subtitle')}
        </p>

        {/* Feature list */}
        <ul className="space-y-5 pt-4">
          {features.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-4">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/60 shadow-inner backdrop-blur">
                <Icon className="size-4 text-[color:var(--color-brand-from)]" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t(`features.${key}.title`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
