import { notFound, redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { TableEditor } from '@/features/projects/components/table-editor';
import { getCurrentUser } from '@/server/auth';
import { getProjectForViewer } from '@/server/projects';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: 'placeholder' }));
}

export default async function ProjectTablesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const project = await getProjectForViewer(user, id);
  if (!project) notFound();

  const t = await getTranslations('projects.tables');

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { labelKey: 'projects', href: '/projects' },
          { label: project.name, href: `/projects/${project.id}` },
          { label: t('breadcrumb') },
        ]}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t('pageTitle')}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('pageSubtitle')}</p>
          </header>

          <TableEditor projectId={project.id} />
        </div>
      </main>
    </>
  );
}
