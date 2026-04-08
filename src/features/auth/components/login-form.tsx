'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Login form for SubterraDB.
// Posts to /api/auth/login, which sets an httpOnly session cookie on success
// and returns the authenticated user. Backend errors come back with stable
// `code` strings that we resolve through i18n.
export function LoginForm() {
  const t = useTranslations('auth.signIn');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setErrorCode(body.code ?? 'networkError');
        setSubmitting(false);
        return;
      }

      // Session cookie is now set. Navigate to the dashboard.
      router.push('/projects');
      router.refresh();
    } catch {
      setErrorCode('networkError');
      setSubmitting(false);
    }
  };

  // Maps backend error codes to i18n keys under auth.errors.
  // Anything we don't recognize falls back to a generic network error.
  const errorMessage = (() => {
    if (!errorCode) return null;
    switch (errorCode) {
      case 'auth.invalid_credentials':
        return tErrors('invalidCredentials');
      case 'auth.missing_fields':
        return tErrors('emailRequired');
      default:
        return tErrors('networkError');
    }
  })();

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl">{t('title')}</CardTitle>
          <CardDescription className="text-balance text-base text-muted-foreground">
            {t('subtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('passwordLabel')}</Label>
                <Link
                  href="/login"
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-[color:var(--color-brand-from)]"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={submitting}
              className="mt-2 w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                <>
                  {t('submit')}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-start border-t border-border/40 pt-6 text-muted-foreground">
          <div>
            <span>{t('noAccount')} </span>
            <Link
              href="/signup"
              className="font-medium text-foreground transition-colors hover:text-[color:var(--color-brand-from)]"
            >
              {t('signUpLink')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
