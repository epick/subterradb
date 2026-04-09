import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { ProjectDetailHeader } from '@/features/projects/components/project-detail-header';
import { ProjectDetailTabs } from '@/features/projects/components/project-detail-tabs';
import { ProvisioningPoller } from '@/features/projects/components/provisioning-poller';
import { getCurrentUser } from '@/server/auth';
import { getProjectForViewer } from '@/server/projects';
import { projectDatabaseName } from '@/server/project-db';
import { env } from '@/server/env';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

interface ProjectDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const project = await getProjectForViewer(user, id);
  if (!project) notFound();

  const projectUrl = `${env.kongProxyUrl}/${project.slug}`;

  // Developer-facing Postgres connection URL. host:port comes from the PUBLIC
  // env vars (defaults to localhost) so developers can paste it into psql /
  // their MCP config / their app from outside the docker network. The postgres
  // superuser is intentional — devs need full access to their own DB.
  const projectDbName = projectDatabaseName(project.slug);
  const dbUrl = `postgresql://postgres:postgres@${env.publicDbHost}:${env.publicDbPort}/${projectDbName}`;

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { labelKey: 'projects', href: '/projects' },
          { label: project.name },
        ]}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <ProjectDetailHeader project={project} canManage={user.role === 'admin'} />
          {/* Polls /api/projects/[id] every 2s while provisioning, then
              router.refresh()es so the page picks up the new status. */}
          <ProvisioningPoller projectId={project.id} status={project.status} />
          <ProjectDetailTabs
            project={project}
            projectUrl={projectUrl}
            dbUrl={dbUrl}
          />
        </div>
      </main>
    </>
  );
}

// Avoid prerender — every request needs the session.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: 'placeholder' }));
}
