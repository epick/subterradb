'use client';

import { useState } from 'react';
import { KeyRound, Loader2, MoreHorizontal, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Member } from '../types';

interface MemberActionsProps {
  member: Member;
  /** The ID of the currently logged-in user — prevents self-delete. */
  currentUserId: string;
}

export function MemberActions({ member, currentUserId }: MemberActionsProps) {
  const tMenu = useTranslations('members.table.menu');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const isSelf = member.id === currentUserId;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
            <KeyRound className="size-4" />
            {tMenu('changePassword')}
          </DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="text-red-400 focus:text-red-300"
            >
              <Trash2 className="size-4" />
              {tMenu('delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        member={member}
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
      <DeleteMemberDialog
        member={member}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Change password dialog
// ---------------------------------------------------------------------------

function ChangePasswordDialog({
  member,
  open,
  onOpenChange,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('members.changePassword');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassword('');
    setError(null);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${member.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setError(body.code ?? 'unknown');
        setSubmitting(false);
        return;
      }
      onOpenChange(false);
      reset();
      router.refresh();
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10">
            <KeyRound className="size-5 text-[color:var(--color-brand-from)]" />
          </div>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { name: member.name })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('password')}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {t(`errors.${error.replace(/\./g, '_')}`)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="brand"
            onClick={onSubmit}
            disabled={password.length < 8 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('updating')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete member dialog
// ---------------------------------------------------------------------------

function DeleteMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('members.delete');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setError(body.code ?? 'unknown');
        setSubmitting(false);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      setError('network');
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <TriangleAlert className="size-5 text-red-400" />
          </div>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { name: member.name })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {t(`errors.${error.replace(/\./g, '_')}`)}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={submitting}
            className="border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-500/70 hover:bg-red-500/20 hover:text-red-100 disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('deleting')}
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                {t('confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
