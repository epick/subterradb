import { setRequestLocale } from 'next-intl/server';
import { AuthSplit } from '@/components/layout/auth-split';
import { LoginForm } from '@/features/auth/components/login-form';
import { LoginHero } from '@/features/auth/components/login-hero';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthSplit aside={<LoginHero />} asidePosition="left">
      <LoginForm />
    </AuthSplit>
  );
}
