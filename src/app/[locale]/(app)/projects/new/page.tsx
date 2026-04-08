import { setRequestLocale } from 'next-intl/server';
import { AppTopbar } from '@/components/layout/app-topbar';
import { NewProjectForm } from '@/features/projects/components/new-project-form';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { labelKey: 'projects', href: '/projects' },
          { labelKey: 'newProject' },
        ]}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <NewProjectForm />
        </div>
      </main>
    </>
  );
}
