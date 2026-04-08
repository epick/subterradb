'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileText,
  FolderPlus,
  Loader2,
  Package,
  Trash2,
  Upload,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface StorageBrowserProps {
  projectId: string;
}

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredObject {
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Two-pane Storage browser. Mirrors the Table editor layout: bucket list on
// the left, object grid on the right with upload + delete actions.
export function StorageBrowser({ projectId }: StorageBrowserProps) {
  const t = useTranslations('projects.storage');
  const format = useFormatter();
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [objects, setObjects] = useState<StoredObject[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingObject, setDeletingObject] = useState<string | null>(null);
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBuckets = async () => {
    const res = await fetch(`/api/projects/${projectId}/storage/buckets`);
    const body = (await res.json()) as { buckets?: Bucket[] };
    setBuckets(body.buckets ?? []);
  };

  const loadObjects = async (bucket: string) => {
    setObjects(null);
    const res = await fetch(`/api/projects/${projectId}/storage/buckets/${bucket}/objects`);
    const body = (await res.json()) as { objects?: StoredObject[] };
    setObjects(body.objects ?? []);
  };

  useEffect(() => {
    void loadBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (buckets && buckets.length > 0 && selected === null) {
      setSelected(buckets[0].name);
    }
  }, [buckets, selected]);

  useEffect(() => {
    if (selected) void loadObjects(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const onUpload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      await fetch(`/api/projects/${projectId}/storage/buckets/${selected}/objects`, {
        method: 'POST',
        body: fd,
      });
      await loadObjects(selected);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDeleteObject = async (name: string) => {
    if (!selected) return;
    setDeletingObject(name);
    try {
      await fetch(
        `/api/projects/${projectId}/storage/buckets/${selected}/objects/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      );
      await loadObjects(selected);
    } finally {
      setDeletingObject(null);
    }
  };

  const onDeleteBucket = async (name: string) => {
    setDeletingBucket(name);
    try {
      await fetch(`/api/projects/${projectId}/storage/buckets/${name}`, {
        method: 'DELETE',
      });
      if (selected === name) setSelected(null);
      await loadBuckets();
    } finally {
      setDeletingBucket(null);
    }
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Bucket list */}
        <aside className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-[color:var(--color-brand-from)]" />
              <h2 className="text-sm font-semibold text-foreground">{t('buckets')}</h2>
              <span className="ml-1 text-xs text-muted-foreground">{buckets?.length ?? 0}</span>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label={t('newBucket')}
              className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground"
            >
              <FolderPlus className="size-3.5" />
            </button>
          </header>

          {buckets === null ? (
            <div className="flex items-center justify-center px-4 py-8 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              {t('loading')}
            </div>
          ) : buckets.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {t('noBuckets')}
            </div>
          ) : (
            <ul className="max-h-[480px] divide-y divide-border/30 overflow-y-auto">
              {buckets.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    'group flex items-center gap-2 px-4 py-3 transition-colors',
                    selected === b.name
                      ? 'bg-[color:var(--color-brand-from)]/10'
                      : 'hover:bg-card/40',
                    deletingBucket === b.name && 'opacity-30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(b.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Package
                      className={cn(
                        'size-3.5 shrink-0',
                        selected === b.name
                          ? 'text-[color:var(--color-brand-from)]'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate font-mono text-xs font-semibold',
                          selected === b.name ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {b.name}
                      </p>
                      <p className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                        {b.public ? (
                          <>
                            <Eye className="size-2.5" />
                            {t('public')}
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-2.5" />
                            {t('private')}
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBucket(b.name)}
                    disabled={deletingBucket === b.name}
                    aria-label="Delete bucket"
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                  >
                    {deletingBucket === b.name ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Object list */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {!selected ? (
            <div className="px-6 py-20 text-center text-sm text-muted-foreground">
              {t('selectBucket')}
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                <div>
                  <h2 className="font-mono text-sm font-semibold text-foreground">{selected}</h2>
                  <p className="text-xs text-muted-foreground">
                    {objects === null ? t('loading') : t('objectCount', { count: objects.length })}
                  </p>
                </div>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {t('uploading')}
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      {t('upload')}
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                  }}
                />
              </header>

              {objects === null ? (
                <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : objects.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                  {t('noObjects')}
                </div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {objects.map((obj) => (
                    <li
                      key={obj.name}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 transition-colors hover:bg-card/40',
                        deletingObject === obj.name && 'opacity-30',
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40">
                        <FileText className="size-4 text-[color:var(--color-brand-from)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{obj.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format.number(obj.size)} bytes
                          {obj.mimeType ? ` · ${obj.mimeType}` : ''}
                          {obj.createdAt
                            ? ` · ${format.dateTime(new Date(obj.createdAt), {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteObject(obj.name)}
                        disabled={deletingObject === obj.name}
                        aria-label="Delete object"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                      >
                        {deletingObject === obj.name ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <CreateBucketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (name, isPublic) => {
          const res = await fetch(`/api/projects/${projectId}/storage/buckets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, public: isPublic }),
          });
          if (res.ok) {
            await loadBuckets();
            setSelected(name);
            setCreateOpen(false);
          }
          return res.ok;
        }}
      />
    </>
  );
}

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, isPublic: boolean) => Promise<boolean>;
}

function CreateBucketDialog({ open, onOpenChange, onCreate }: CreateBucketDialogProps) {
  const t = useTranslations('projects.storage');
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setIsPublic(false);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onCreate(name, isPublic);
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newBucket')}</DialogTitle>
          <DialogDescription>{t('newBucketDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bucket-name">{t('bucketName')}</Label>
            <Input
              id="bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="avatars"
              required
              className="font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('bucketNameHelper')}</p>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('makePublic')}</p>
              <p className="text-xs text-muted-foreground">{t('makePublicHelper')}</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="brand" disabled={submitting || !name}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
