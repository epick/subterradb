import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SubterraDbLogo } from '@/components/brand/subterradb-logo';
import { Link } from '@/i18n/navigation';

// Auth shell shared by every (auth) route. Provides:
//  - Top header with the wordmark and language switcher.
//  - Subtle global ambient elements (corner glows + dot grid) for atmosphere.
//  - A full-bleed <main> so individual pages can compose their own layouts
//    (centered card, split hero, full-bleed image, etc.) without fighting it.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      {/* Subtle ambient brand accents — kept small so split pages can host their own visuals */}
      <div
        aria-hidden
        className="brand-glow pointer-events-none absolute -left-32 -top-32 size-[22rem] rounded-full opacity-50"
      />
      <div
        aria-hidden
        className="brand-glow pointer-events-none absolute -right-32 -bottom-32 size-[22rem] rounded-full opacity-40"
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] [background-size:24px_24px]"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/login"
          className="flex items-center text-foreground transition hover:opacity-80"
        >
          <SubterraDbLogo className="h-11" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}
