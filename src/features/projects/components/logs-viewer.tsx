'use client';

import { useEffect, useRef, useState } from 'react';
import { Cloud, Database, Lock, Pause, Play, ScrollText, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogsViewerProps {
  projectId: string;
}

const CONTAINERS = [
  { key: 'postgrest', icon: Database, label: 'PostgREST' },
  { key: 'gotrue', icon: Lock, label: 'GoTrue (Auth)' },
  { key: 'storage', icon: Cloud, label: 'Storage' },
] as const;

type ContainerKey = (typeof CONTAINERS)[number]['key'];

// Logs viewer with live tail. Uses Server-Sent Events from
// /api/projects/[id]/logs/[container]. The user can pick which container,
// pause/resume the stream, and clear the buffer.
export function LogsViewer({ projectId }: LogsViewerProps) {
  const t = useTranslations('projects.logs');
  const [active, setActive] = useState<ContainerKey>('postgrest');
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Open a new SSE connection when the active container changes.
  useEffect(() => {
    setLines([]);
    const es = new EventSource(`/api/projects/${projectId}/logs/${active}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        const next = [...prev, event.data];
        // Cap the buffer at 2000 lines so memory doesn't grow unbounded.
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    };
    es.onerror = () => {
      // The browser auto-reconnects; nothing to do.
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [projectId, active]);

  // Auto-scroll to the bottom whenever new lines come in (unless paused).
  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, paused]);

  return (
    <div className="space-y-4">
      {/* Container picker */}
      <div className="flex flex-wrap gap-2">
        {CONTAINERS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              active === key
                ? 'border-[color:var(--color-brand-from)]/50 bg-[color:var(--color-brand-from)]/10 text-foreground'
                : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-3.5',
                active === key
                  ? 'text-[color:var(--color-brand-from)]'
                  : 'text-muted-foreground',
              )}
            />
            <span>{label}</span>
            <span className="font-mono text-[0.625rem] uppercase tracking-wider opacity-70">
              {key}_*
            </span>
          </button>
        ))}
      </div>

      {/* Log viewer card */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-[color:var(--color-brand-from)]" />
            <h2 className="text-sm font-semibold text-foreground">{active}_*</h2>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider',
                paused
                  ? 'bg-amber-500/10 text-amber-300'
                  : 'bg-emerald-500/10 text-emerald-300',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  paused ? 'bg-amber-400' : 'animate-pulse bg-emerald-400 shadow-[0_0_6px_currentColor]',
                )}
              />
              {paused ? t('paused') : t('tailing')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <>
                  <Play className="size-3.5" />
                  {t('resume')}
                </>
              ) : (
                <>
                  <Pause className="size-3.5" />
                  {t('pause')}
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLines([])}>
              <Trash2 className="size-3.5" />
              {t('clear')}
            </Button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="h-[520px] overflow-auto bg-[#0f0f12] px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/85"
        >
          {lines.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
              {t('noLogs')}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words">
              {lines.map((line, i) => (
                <div key={i} className="hover:bg-white/[0.02]">
                  {line}
                </div>
              ))}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
