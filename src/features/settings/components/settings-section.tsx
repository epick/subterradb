import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  danger?: boolean;
}

// Top-level container for one section of the settings page.
// Renders a card with a sticky-feeling header and divided rows beneath it.
export function SettingsSection({
  title,
  subtitle,
  children,
  danger,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl',
        danger ? 'border-red-500/30' : 'border-border/60',
      )}
    >
      <header
        className={cn(
          'border-b px-6 py-4',
          danger ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-border/40',
        )}
      >
        <h2
          className={cn(
            'text-base font-semibold',
            danger ? 'text-red-300' : 'text-foreground',
          )}
        >
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="divide-y divide-border/40">{children}</div>
    </section>
  );
}
