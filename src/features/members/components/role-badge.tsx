import { ShieldCheck, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { MemberRole } from '../types';

interface RoleBadgeProps {
  role: MemberRole;
}

// Visual differentiator between admins and developers.
// Admins get the brand-toned pill (they're the privileged role); developers
// get a quieter neutral pill so the page reads at a glance.
export function RoleBadge({ role }: RoleBadgeProps) {
  const t = useTranslations('members.role');
  const Icon = role === 'admin' ? ShieldCheck : Wrench;

  return (
    <Badge tone={role === 'admin' ? 'brand' : 'neutral'}>
      <Icon className="size-3" />
      {t(role)}
    </Badge>
  );
}
