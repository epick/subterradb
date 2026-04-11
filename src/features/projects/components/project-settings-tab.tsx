'use client';

import { TriangleAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { DeleteProjectDialog } from './delete-project-dialog';
import type { ProjectWithKeys } from './types-client';

interface ProjectSettingsTabProps {
  project: ProjectWithKeys;
  canManage: boolean;
}

export function ProjectSettingsTab({ project, canManage }: ProjectSettingsTabProps) {
  const t = useTranslations('projects.detail.settingsTab');
  const format = useFormatter();

  const created = format.dateTime(new Date(project.createdAt), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="space-y-6">
      {/* General */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('general')}</h2>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="divide-y divide-border/40">
            <SettingRow label={t('projectName')} value={project.name} />
            <SettingRow label={t('projectSlug')} value={project.slug} mono hint={t('slugHint')} />
            <SettingRow label={t('createdAt')} value={created} />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      {canManage && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-red-400">{t('dangerZone')}</h2>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{t('deleteProject')}</p>
                  <p className="text-xs text-muted-foreground">{t('deleteDescription')}</p>
                </div>
              </div>
              <DeleteProjectDialog
                projectId={project.id}
                projectName={project.name}
                projectSlug={project.slug}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingRow({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <p className={`text-sm text-muted-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
