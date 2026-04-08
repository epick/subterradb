import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '../types';

const TONE_BY_STATUS: Record<
  ProjectStatus,
  React.ComponentProps<typeof Badge>['tone']
> = {
  running: 'success',
  stopped: 'neutral',
  provisioning: 'warning',
  error: 'danger',
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const t = useTranslations('projects.status');
  return (
    <Badge tone={TONE_BY_STATUS[status]} dot>
      {t(status)}
    </Badge>
  );
}
