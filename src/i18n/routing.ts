import { defineRouting } from 'next-intl/routing';

// SubterraDB supported locales.
// English is the canonical / fallback language. Spanish is a first-class translation.
export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
