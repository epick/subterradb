import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { getCurrentUser } from '@/server/auth';
import { env } from '@/server/env';

// Authenticated app shell.
// Locks the viewport at h-screen and disables outer scrolling so the sidebar
// and topbar stay perfectly fixed; the only scrollable surface is the <main>
// inside each page (which uses overflow-y-auto + min-h-0).
//
// Reads the session here so the sidebar can render the real user without
// every child page having to fetch /api/auth/me on its own.
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  return (
    <div className="relative isolate flex h-screen overflow-hidden">
      {/* Subtle ambient brand accents — fixed so they don't scroll with content */}
      <div
        aria-hidden
        className="brand-glow pointer-events-none fixed -left-40 top-1/4 size-[28rem] rounded-full opacity-25"
      />
      <div
        aria-hidden
        className="brand-glow pointer-events-none fixed -right-40 bottom-0 size-[28rem] rounded-full opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)] [background-size:24px_24px]"
      />

      <AppSidebar user={user} version={env.version} />
      <div className="relative z-10 flex min-w-0 min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
