import { ExternalLink } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { Button } from '@/components/ui/button';
import { GatewayStats } from '@/features/gateway/components/gateway-stats';
import { RoutesTable } from '@/features/gateway/components/routes-table';
import { getCurrentUser } from '@/server/auth';
import { getGatewaySnapshot } from '@/server/gateway';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function GatewayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}/projects`);

  const t = await getTranslations('gateway.page');

  let snapshot:
    | Awaited<ReturnType<typeof getGatewaySnapshot>>
    | { routes: never[]; stats: { services: 0; routes: 0; plugins: 0; requestsPerHour: 0 } };
  let kongUnreachable = false;
  try {
    snapshot = await getGatewaySnapshot();
  } catch {
    kongUnreachable = true;
    snapshot = { routes: [], stats: { services: 0, routes: 0, plugins: 0, requestsPerHour: 0 } };
  }

  return (
    <>
      <AppTopbar breadcrumbs={[{ labelKey: 'gateway' }]} />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div
                className={
                  kongUnreachable
                    ? 'inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1'
                    : 'inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1'
                }
              >
                <span
                  className={
                    kongUnreachable
                      ? 'size-1.5 rounded-full bg-red-400 shadow-[0_0_8px_theme(colors.red.500)]'
                      : 'size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]'
                  }
                />
                <span
                  className={
                    kongUnreachable
                      ? 'text-[0.65rem] font-semibold uppercase tracking-wider text-red-300'
                      : 'text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-300'
                  }
                >
                  {kongUnreachable ? t('unreachable') : t('healthy')}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('title')}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t('subtitle')}
              </p>
            </div>
            <Button variant="outline" size="default" className="self-start sm:self-auto">
              <ExternalLink className="size-3.5" />
              {t('openAdminApi')}
            </Button>
          </header>

          <GatewayStats stats={snapshot.stats} />
          <RoutesTable routes={snapshot.routes} />
        </div>
      </main>
    </>
  );
}
