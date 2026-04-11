import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { SettingsTabs } from '@/features/settings/components/settings-tabs';
import { getCurrentUser } from '@/server/auth';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/projects`);

  const t = await getTranslations('settings.page');

  return (
    <>
      <AppTopbar breadcrumbs={[{ labelKey: 'settings' }]} />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t('subtitle')}
            </p>
          </header>

          <SettingsTabs />
        </div>
      </main>
    </>
  );
}
