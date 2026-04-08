'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CopyButtonProps {
  value: string;
  className?: string;
}

// Small icon button that copies its value to the clipboard and confirms with
// a green check + tooltip for ~1.5s. Used inside connection cards.
export function CopyButton({ value, className }: CopyButtonProps) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in insecure contexts; silently fail.
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={copied ? t('copied') : t('copy')}
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground transition-colors',
              'hover:border-[color:var(--color-brand-from)]/40 hover:text-foreground',
              copied && 'border-emerald-500/40 text-emerald-300',
              className,
            )}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? t('copied') : t('copy')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
