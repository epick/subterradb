import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DeleteProjectDialog } from './delete-project-dialog';
import { ProjectPowerButton } from './project-power-button';
import { ProjectStatusBadge } from './project-status-badge';
import type { ProjectWithKeys } from './types-client';

interface ProjectDetailHeaderProps {
  project: ProjectWithKeys;
  /** Only admins can stop / delete projects. */
  canManage: boolean;
}

// Header block at the top of the project detail page.
// Renders the project name, slug, status, and primary actions.
// Stop / Start / Delete are admin-only.
export function ProjectDetailHeader({ project, canManage }: ProjectDetailHeaderProps) {
  const t = useTranslations('projects.detail.header');

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {project.name}
          </h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">{project.slug}</p>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPowerButton projectId={project.id} status={project.status} />
          <DeleteProjectDialog
            projectId={project.id}
            projectName={project.name}
            projectSlug={project.slug}
          />
          <Button variant="outline" size="icon" aria-label={t('settings')}>
            <Settings2 className="size-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
