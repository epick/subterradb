'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  Database,
  Loader2,
  Lock,
  RefreshCw,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Auto-derives a URL/container-safe slug from any free-text name.
// Mirrors the canonical Supabase behavior: lowercase, ASCII, hyphenated.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

// Mock cryptographically-strong password — replaced by a server-side
// generator once the control plane is in place.
function generatePassword(length = 24): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  if (typeof window === 'undefined') return ''.padEnd(length, '•');
  const out = new Array<string>(length);
  const random = new Uint32Array(length);
  window.crypto.getRandomValues(random);
  for (let i = 0; i < length; i++) {
    out[i] = alphabet[random[i] % alphabet.length];
  }
  return out.join('');
}

const SERVICE_OPTIONS = [
  { key: 'postgrest', icon: Database },
  { key: 'auth', icon: Lock },
  { key: 'storage', icon: Cloud },
  { key: 'realtime', icon: Radio },
] as const;

export function NewProjectForm() {
  const t = useTranslations('projects.new');
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [dbPassword, setDbPassword] = useState(() => generatePassword());
  const [services, setServices] = useState<Record<string, boolean>>({
    postgrest: true,
    auth: true,
    storage: true,
    realtime: true,
  });
  const [inviteEmails, setInviteEmails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const toggleService = (key: string) => {
    setServices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, dbPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setErrorCode(body.code ?? 'projects.unknown_error');
        setSubmitting(false);
        return;
      }
      // Backend returns 201 immediately with the row in `provisioning` state.
      // Take the user straight to the projects list — the new card already
      // shows up there with a "provisioning" badge that flips to "running"
      // automatically once the background provisioning finishes (~20-30s).
      router.push('/projects');
      router.refresh();
    } catch {
      setErrorCode('projects.network_error');
      setSubmitting(false);
    }
  };

  const errorMessage = (() => {
    if (!errorCode) return null;
    switch (errorCode) {
      case 'projects.slug_taken':
        return t('errors.slugTaken');
      case 'projects.name_required':
      case 'projects.slug_required':
        return t('errors.nameRequired');
      case 'projects.kong_failed':
        return t('errors.kongFailed');
      case 'projects.forbidden':
        return t('errors.forbidden');
      default:
        return t('errors.unknown');
    }
  })();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Back link + heading */}
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('back')}
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Section 1 — Basics */}
      <FormSection
        title={t('sections.basics.title')}
        subtitle={t('sections.basics.subtitle')}
      >
        <div className="space-y-2">
          <Label htmlFor="name">{t('fields.name')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('fields.namePlaceholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t('fields.slug')}</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            placeholder="my-project"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('fields.slugHelper')}</p>
        </div>
      </FormSection>

      {/* Section 2 — Database */}
      <FormSection
        title={t('sections.database.title')}
        subtitle={t('sections.database.subtitle')}
      >
        <div className="space-y-2">
          <Label htmlFor="dbPassword">{t('fields.dbPassword')}</Label>
          <div className="flex gap-2">
            <Input
              id="dbPassword"
              type="text"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              required
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setDbPassword(generatePassword())}
              className="shrink-0"
            >
              <RefreshCw className="size-3.5" />
              {t('fields.generatePassword')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('fields.dbPasswordHelper')}</p>
        </div>
      </FormSection>

      {/* Section 3 — Services */}
      <FormSection
        title={t('sections.services.title')}
        subtitle={t('sections.services.subtitle')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_OPTIONS.map(({ key, icon: Icon }) => {
            const checked = !!services[key];
            return (
              <label
                key={key}
                className={cn(
                  'group flex cursor-pointer items-start gap-3 rounded-xl border bg-background/40 p-4 transition-all',
                  checked
                    ? 'border-[color:var(--color-brand-from)]/40 bg-[color:var(--color-brand-from)]/5'
                    : 'border-border/60 hover:border-border',
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleService(key)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'size-4 transition-colors',
                        checked
                          ? 'text-[color:var(--color-brand-from)]'
                          : 'text-muted-foreground',
                      )}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {t(`fields.${key}`)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`fields.${key}Helper`)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </FormSection>

      {/* Section 4 — Initial access */}
      <FormSection
        title={t('sections.access.title')}
        subtitle={t('sections.access.subtitle')}
      >
        <div className="space-y-2">
          <Label htmlFor="invites">{t('fields.invites')}</Label>
          <Textarea
            id="invites"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder={t('fields.invitesPlaceholder')}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">{t('fields.invitesHelper')}</p>
        </div>
      </FormSection>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild type="button" variant="ghost">
          <Link href="/projects">{t('cancel')}</Link>
        </Button>
        <Button type="submit" variant="brand" size="lg" disabled={submitting || !name || !slug}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              {t('submit')}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface FormSectionProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

// Reusable card for a single block of related form fields. Mirrors the
// "section card" style used across the rest of the app.
function FormSection({ title, subtitle, children }: FormSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
      <header className="border-b border-border/40 px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}
