'use client';

import { useEffect, useState } from 'react';
import { Info, Loader2, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
}

interface ProjectMembersTabProps {
  projectId: string;
  members: ProjectMember[];
  isAdmin: boolean;
}

export function ProjectMembersTab({ projectId, members: initialMembers, isAdmin }: ProjectMembersTabProps) {
  const t = useTranslations('projects.detail.membersTab');
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [allDevelopers, setAllDevelopers] = useState<ProjectMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch all developers for the add-member dropdown.
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/members')
      .then((r) => r.json())
      .then((data) => {
        const devs = (data.members ?? []).filter(
          (m: { role: string }) => m.role === 'developer',
        );
        setAllDevelopers(devs);
      })
      .catch(() => {});
  }, [isAdmin]);

  const assignedIds = new Set(members.map((m) => m.id));
  const availableDevelopers = allDevelopers.filter((d) => !assignedIds.has(d.id));

  const addMember = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (res.ok) {
        const dev = allDevelopers.find((d) => d.id === selectedUserId);
        if (dev) setMembers((prev) => [...prev, dev]);
        setSelectedUserId('');
        router.refresh();
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
        router.refresh();
      }
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Admin note */}
      <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-background/30 p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-from)]" />
        <p className="text-xs text-muted-foreground">{t('adminsNote')}</p>
      </div>

      {/* Add member (admin only) */}
      {isAdmin && availableDevelopers.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('selectMember')} />
            </SelectTrigger>
            <SelectContent>
              {availableDevelopers.map((dev) => (
                <SelectItem key={dev.id} value={dev.id}>
                  {dev.name} ({dev.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="brand"
            size="default"
            onClick={addMember}
            disabled={!selectedUserId || adding}
          >
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {t('addMember')}
          </Button>
        </div>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-card/40 py-12 text-center backdrop-blur-xl">
          <p className="text-sm font-medium text-muted-foreground">{t('noMembers')}</p>
          <p className="text-xs text-muted-foreground/70">{t('noMembersHint')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
          <ul className="divide-y divide-border/40">
            {members.map((member) => {
              const initials = member.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <li key={member.id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                      disabled={removingId === member.id}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      {removingId === member.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      {t('removeMember')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
