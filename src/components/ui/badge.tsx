import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Status / metadata pill. The "tone" prop maps to semantic states used across
// the dashboard (running / stopped / error / provisioning, etc.).
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      tone: {
        neutral: 'border-border/60 bg-muted/40 text-muted-foreground',
        success:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 [--dot:theme(colors.emerald.400)]',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-300 [--dot:theme(colors.amber.400)]',
        danger:
          'border-red-500/30 bg-red-500/10 text-red-300 [--dot:theme(colors.red.400)]',
        brand:
          'border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10 text-[color:var(--color-brand-from)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a colored leading dot (uses the tone's color). */
  dot?: boolean;
}

function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span
          className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
