'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionCard } from './connection-card';
import { McpConfigCard } from './mcp-config-card';
import { ProjectApiKeysTab } from './project-api-keys-tab';
import { ProjectDatabaseTab } from './project-database-tab';
import { ProjectDetailStats } from './project-detail-stats';
import { ProjectMembersTab } from './project-members-tab';
import { ProjectQuickActions } from './project-quick-actions';
import { ProjectServicesTab } from './project-services-tab';
import { ProjectSettingsTab } from './project-settings-tab';
import type { ProjectWithKeys } from './types-client';

interface ProjectDetailTabsProps {
  project: ProjectWithKeys;
  /** Pre-built gateway URL with the project slug appended (used by the MCP card) */
  projectUrl: string;
  /** Pre-built Postgres connection URL for the project's database */
  dbUrl: string;
  /** Whether the current user can manage (admin actions) */
  canManage: boolean;
}

const BASE_TABS = ['overview', 'services', 'apiKeys', 'database', 'members'] as const;

export function ProjectDetailTabs({
  project,
  projectUrl,
  dbUrl,
  canManage,
}: ProjectDetailTabsProps) {
  const t = useTranslations('projects.detail.tabs');
  const tabs = canManage ? [...BASE_TABS, 'settings' as const] : BASE_TABS;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <ProjectDetailStats project={project} />
        <ProjectQuickActions projectId={project.id} />
        <ConnectionCard project={project} projectUrl={projectUrl} dbUrl={dbUrl} />
        <McpConfigCard
          projectSlug={project.slug}
          serviceKey={project.serviceKey}
          dbUrl={dbUrl}
          projectUrl={projectUrl}
        />
      </TabsContent>

      <TabsContent value="services">
        <ProjectServicesTab projectId={project.id} />
      </TabsContent>

      <TabsContent value="apiKeys">
        <ProjectApiKeysTab project={project} />
      </TabsContent>

      <TabsContent value="database">
        <ProjectDatabaseTab project={project} dbUrl={dbUrl} />
      </TabsContent>

      <TabsContent value="members">
        <ProjectMembersTab
          projectId={project.id}
          members={project.members}
          isAdmin={canManage}
        />
      </TabsContent>

      {canManage && (
        <TabsContent value="settings">
          <ProjectSettingsTab project={project} canManage={canManage} />
        </TabsContent>
      )}
    </Tabs>
  );
}
