'use client';

import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  /** Column metadata for the rendered header chip inside the popover. */
  column: {
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
  };
  /** Current value of the cell. NULL is shown as the literal "NULL" placeholder. */
  value: unknown;
  /** Read-only cells (e.g. when there's no primary key, so we can't address the row). */
  readOnly?: boolean;
  /** Called when the user saves a new value. The empty string represents NULL. */
  onSave: (newValue: string | null) => Promise<void>;
}

// Single-cell editor matching Supabase Studio's pattern: click any cell →
// inline popover anchored to the cell with a textarea, Save / Cancel /
// Set to NULL buttons, and an expand-to-fullscreen toggle for big values.
//
// Keyboard shortcuts:
//   - Enter        → save (without Shift)
//   - Shift+Enter  → newline
//   - Esc          → cancel
//
// The popover only closes after a successful save (or cancel) so error states
// stay visible.
export function EditableCell({ column, value, readOnly, onSave }: EditableCellProps) {
  const t = useTranslations('projects.tables.cell');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const display = formatCellDisplay(value);
  const isNull = value === null || value === undefined;

  // Reset state every time the popover opens.
  useEffect(() => {
    if (!open) return;
    setDraft(isNull ? '' : stringifyForEdit(value));
    setError(null);
    setFullscreen(false);
    // Focus the textarea on the next tick so Radix can mount it.
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
      }
    }, 50);
  }, [open, isNull, value]);

  const commit = async (asNull: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      await onSave(asNull ? null : draft);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void commit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Read-only cells just render the value with no interactivity.
  if (readOnly) {
    return (
      <span
        className={cn(
          'block max-w-[360px] truncate font-mono',
          isNull ? 'text-muted-foreground/60' : 'text-foreground/90',
        )}
      >
        {display}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Block form submission accidents — this is a div-styled button.
          className={cn(
            'block w-full max-w-[360px] truncate text-left font-mono',
            'rounded-sm transition-colors hover:bg-[color:var(--color-brand-from)]/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-brand-from)]/50',
            isNull ? 'text-muted-foreground/60' : 'text-foreground/90',
            column.isPrimaryKey && 'cursor-default opacity-80',
          )}
          // Primary key edits are technically allowed by the backend but a bad
          // idea — block them in the UI to mirror Supabase Studio.
          disabled={column.isPrimaryKey}
        >
          {display}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          'overflow-hidden p-0',
          fullscreen ? 'w-[640px]' : 'w-[360px]',
        )}
        // Don't close when the user clicks the textarea or buttons.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header strip — shows column metadata */}
        <header className="flex items-center justify-between border-b border-border/40 bg-card/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs font-semibold text-foreground">
              {column.name}
            </span>
            <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {column.dataType}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? t('shrink') : t('expand')}
            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {fullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </header>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={column.isNullable ? t('placeholderNullable') : t('placeholder')}
          spellCheck={false}
          className={cn(
            'block w-full resize-none border-0 bg-background/40 px-3 py-2.5 font-mono text-xs text-foreground/90 outline-none placeholder:text-muted-foreground/50',
            fullscreen ? 'h-[300px]' : 'h-[120px]',
          )}
        />

        {error && (
          <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-[0.65rem] text-red-300">
            <pre className="whitespace-pre-wrap font-mono">{error}</pre>
          </div>
        )}

        {/* Footer with the action buttons */}
        <footer className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void commit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[0.65rem] font-medium text-foreground transition-colors hover:border-[color:var(--color-brand-from)]/50 hover:bg-[color:var(--color-brand-from)]/10 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CornerDownLeft className="size-3" />
              )}
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <X className="size-3" />
              {t('cancel')}
            </button>
          </div>
          {column.isNullable && (
            <button
              type="button"
              onClick={() => void commit(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-40"
            >
              {t('setNull')}
            </button>
          )}
        </footer>
      </PopoverContent>
    </Popover>
  );
}

function formatCellDisplay(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function stringifyForEdit(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
