'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionCard } from './connection-card';
import { McpConfigCard } from './mcp-config-card';
import { ProjectDetailStats } from './project-detail-stats';
import { ProjectQuickActions } from './project-quick-actions';
import type { ProjectWithKeys } from './types-client';

interface ProjectDetailTabsProps {
  project: ProjectWithKeys;
  /** Absolute path on the SubterraDB host to packages/mcp-server/dist/index.js */
  mcpServerPath: string;
  /** Pre-built gateway URL with the project slug appended (used by the MCP card) */
  projectUrl: string;
  /** Pre-built Postgres connection URL for the project's database */
  dbUrl: string;
}

const TABS = ['overview', 'services', 'apiKeys', 'database', 'members', 'settings'] as const;

export function ProjectDetailTabs({
  project,
  mcpServerPath,
  projectUrl,
  dbUrl,
}: ProjectDetailTabsProps) {
  const t = useTranslations('projects.detail.tabs');

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {TABS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <ProjectDetailStats project={project} />
        <ProjectQuickActions projectId={project.id} />
        <ConnectionCard project={project} />
        <McpConfigCard
          projectSlug={project.slug}
          serviceKey={project.serviceKey}
          dbUrl={dbUrl}
          projectUrl={projectUrl}
          mcpServerPath={mcpServerPath}
        />
      </TabsContent>

      {/* Placeholder content for tabs that aren't implemented yet — kept on-brand */}
      {(['services', 'apiKeys', 'database', 'members', 'settings'] as const).map((key) => (
        <TabsContent key={key} value={key}>
          <ComingSoon labelKey={key} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ComingSoon({ labelKey }: { labelKey: string }) {
  const t = useTranslations('projects.detail');
  const tTabs = useTranslations('projects.detail.tabs');

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-20 text-center backdrop-blur-xl">
      <span className="rounded-full border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-from)]">
        {t('comingSoon.kicker')}
      </span>
      <h3 className="text-lg font-semibold text-foreground">{tTabs(labelKey)}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{t('comingSoon.description')}</p>
    </div>
  );
}
