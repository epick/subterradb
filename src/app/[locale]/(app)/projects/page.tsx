import { Plus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppTopbar } from '@/components/layout/app-topbar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ProjectCard } from '@/features/projects/components/project-card';
import { ProjectsStats } from '@/features/projects/components/projects-stats';
import { getCurrentUser } from '@/server/auth';
import { listProjects } from '@/server/projects';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Force dynamic rendering — this page reads cookies and DB state.
export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const t = await getTranslations('projects.dashboard');
  const projects = await listProjects(user);

  return (
    <>
      <AppTopbar breadcrumbs={[{ labelKey: 'projects' }]} />

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
            {user.role === 'admin' && (
              <Button asChild variant="brand" size="lg" className="self-start sm:self-auto">
                <Link href="/projects/new">
                  <Plus className="size-4" />
                  {t('newProject')}
                </Link>
              </Button>
            )}
          </header>

          <ProjectsStats projects={projects} />

          {projects.length === 0 ? (
            <EmptyState locale={locale} canCreate={user.role === 'admin'} />
          ) : (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('allProjects')}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t('countLabel', { count: projects.length })}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

async function EmptyState({ canCreate }: { locale: string; canCreate: boolean }) {
  const t = await getTranslations('projects.dashboard.empty');
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-20 text-center backdrop-blur-xl">
      <span className="rounded-full border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-from)]">
        {t('kicker')}
      </span>
      <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t('description')}</p>
      {canCreate && (
        <Button asChild variant="brand" size="lg">
          <Link href="/projects/new">
            <Plus className="size-4" />
            {t('cta')}
          </Link>
        </Button>
      )}
    </div>
  );
}
