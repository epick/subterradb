import { UserPlus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { Button } from '@/components/ui/button';
import { MembersStats } from '@/features/members/components/members-stats';
import { MembersTable } from '@/features/members/components/members-table';
import { getCurrentUser } from '@/server/auth';
import { listMembers } from '@/server/members';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  // Members management is admin-only — devs see a forbidden notice.
  if (user.role !== 'admin') {
    return (
      <>
        <AppTopbar breadcrumbs={[{ labelKey: 'members' }]} />
        <main className="flex flex-1 items-center justify-center px-6">
          <ForbiddenNotice />
        </main>
      </>
    );
  }

  const t = await getTranslations('members.page');
  const members = await listMembers(user);

  return (
    <>
      <AppTopbar breadcrumbs={[{ labelKey: 'members' }]} />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('title')}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t('subtitle')}
              </p>
            </div>
            <Button variant="brand" size="lg" className="self-start sm:self-auto">
              <UserPlus className="size-4" />
              {t('invite')}
            </Button>
          </header>

          <MembersStats members={members} />
          <MembersTable members={members} />
        </div>
      </main>
    </>
  );
}

async function ForbiddenNotice() {
  const t = await getTranslations('members.page.forbidden');
  return (
    <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/40 p-10 text-center backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
    </div>
  );
}
