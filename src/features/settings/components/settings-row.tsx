import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  /** When true, stacks the control under the label (good for long inputs). */
  stacked?: boolean;
  danger?: boolean;
}

// Standard label-on-left, control-on-right row used inside SettingsSection.
// Switches to stacked layout when the control is wide (e.g. a textarea).
export function SettingsRow({
  label,
  description,
  children,
  stacked,
  danger,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-6 py-5',
        stacked ? '' : 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
      )}
    >
      <div className={cn('space-y-1', stacked ? '' : 'sm:max-w-md')}>
        <p
          className={cn(
            'text-sm font-medium',
            danger ? 'text-red-300' : 'text-foreground',
          )}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn(stacked ? 'w-full' : 'sm:w-72')}>{children}</div>
    </div>
  );
}
