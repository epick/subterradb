'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, ChevronRight, Loader2, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Monaco is a heavy dependency (~3MB) — load it client-side only.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Loading editor…
    </div>
  ),
});

interface SqlEditorProps {
  projectId: string;
}

interface SqlResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
}

interface SqlError {
  message: string;
  durationMs?: number;
}

const STARTER_QUERY = `-- Welcome to the SubterraDB SQL editor.
-- The query below runs inside the project's database with service_role privileges.
-- Try it: hit Run, then create your own tables.

select schemaname, tablename
from pg_tables
where schemaname not in ('pg_catalog', 'information_schema')
order by schemaname, tablename;
`;

export function SqlEditor({ projectId }: SqlEditorProps) {
  const t = useTranslations('projects.sql');
  const [query, setQuery] = useState(STARTER_QUERY);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<SqlError | null>(null);
  const [running, setRunning] = useState(false);

  const onRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const body = (await res.json()) as
        | SqlResult
        | { code: string; message?: string; details?: { durationMs?: number } };
      if (!res.ok) {
        const err = body as { code: string; message?: string; details?: { durationMs?: number } };
        setError({
          message: err.message ?? err.code,
          durationMs: err.details?.durationMs,
        });
        setResult(null);
      } else {
        setResult(body as SqlResult);
      }
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : String(e) });
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Editor card */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="size-4 text-[color:var(--color-brand-from)]" />
            <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
          </div>
          <Button variant="brand" size="sm" onClick={onRun} disabled={running}>
            {running ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t('running')}
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                {t('run')}
              </>
            )}
          </Button>
        </header>

        <div className="h-[340px] bg-[#0f0f12]">
          <MonacoEditor
            height="100%"
            defaultLanguage="sql"
            theme="vs-dark"
            value={query}
            onChange={(v) => setQuery(v ?? '')}
            options={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 14 },
              renderLineHighlight: 'line',
              lineNumbersMinChars: 3,
              automaticLayout: true,
            }}
          />
        </div>
      </section>

      {/* Results card */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t('resultsTitle')}</h2>
          <span className="text-xs text-muted-foreground">
            {error ? (
              <span className="text-red-300">{t('error')}</span>
            ) : result ? (
              t('resultsMeta', { count: result.rowCount, ms: result.durationMs })
            ) : (
              t('resultsEmpty')
            )}
          </span>
        </header>

        {error ? (
          <div className="flex items-start gap-3 px-5 py-5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
            <pre className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-xs text-red-300">
              {error.message}
            </pre>
          </div>
        ) : result && result.columns.length > 0 ? (
          <ResultsTable result={result} />
        ) : result ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('rowCountOnly', { count: result.rowCount })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('hint')}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultsTable({ result }: { result: SqlResult }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead className="sticky top-0 bg-background/95 backdrop-blur-xl">
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="border-b border-border/40 px-4 py-2.5 text-left font-mono font-semibold text-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="hover:bg-card/40">
              {result.columns.map((col) => (
                <td
                  key={col}
                  className={cn(
                    'border-b border-border/30 px-4 py-2 font-mono',
                    row[col] === null ? 'text-muted-foreground/60' : 'text-foreground/90',
                  )}
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
