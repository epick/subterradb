'use client';

import { useState } from 'react';
import { Loader2, Trash2, TriangleAlert } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  projectSlug: string;
}

// Confirmation dialog for the destructive "Delete project" action.
// Requires the admin to type the project's slug verbatim before the
// destructive button is enabled — same pattern GitHub / Vercel use for repos
// and projects. Calls DELETE /api/projects/[id] which tears down containers,
// drops the database, removes Kong entities, and finally deletes the row.
export function DeleteProjectDialog({
  projectId,
  projectName,
  projectSlug,
}: DeleteProjectDialogProps) {
  const t = useTranslations('projects.delete');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setError(body.code ?? 'unknown');
        setSubmitting(false);
        return;
      }
      // Out of the project context — go back to the dashboard.
      router.push('/projects');
      router.refresh();
    } catch {
      setError('network');
      setSubmitting(false);
    }
  };

  const canDelete = confirmation === projectSlug && !submitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setConfirmation('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="border-red-500/40 text-red-300 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="size-4" />
          {t('trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <TriangleAlert className="size-5 text-red-400" />
          </div>
          <DialogTitle>{t('title', { name: projectName })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <ul className="space-y-1 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3 text-xs text-red-200/90">
            <li>• {t('bullets.containers')}</li>
            <li>• {t('bullets.database')}</li>
            <li>• {t('bullets.kong')}</li>
            <li>• {t('bullets.keys')}</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="confirm-slug">
              {t.rich('confirmLabel', {
                slug: () => <code className="font-mono text-foreground">{projectSlug}</code>,
              })}
            </Label>
            <Input
              id="confirm-slug"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={projectSlug}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {/*
                Backend codes use dot notation (projects.forbidden) but next-intl
                treats dots as nesting delimiters in i18n keys. We normalize the
                code by replacing dots with underscores so it maps to a flat key
                inside the `errors` namespace.
              */}
              {t(`errors.${error.replace(/\./g, '_')}`)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={!canDelete}
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
