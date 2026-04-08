import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded-lg border border-input bg-background/60 px-3.5 py-2.5 text-sm shadow-sm transition-colors',
      'placeholder:text-muted-foreground/70',
      'focus-visible:border-[color:var(--color-brand-from)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-from)]/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
