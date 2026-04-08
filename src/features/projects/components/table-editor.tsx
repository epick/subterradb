'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Key,
  Loader2,
  Plus,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditableCell } from './editable-cell';

interface TableEditorProps {
  projectId: string;
}

interface TableSummary {
  schema: string;
  name: string;
  rowCount: number;
  columnCount: number;
}

interface TableColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

interface TableDetail {
  schema: string;
  name: string;
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

// Two-pane Table Editor matching Supabase Studio's UX:
//   - Click any cell → inline popover editor anchored to the cell
//   - First column (PK) is sticky-left so it stays visible during horizontal scroll
//   - Checkbox column on the far left for multi-row selection
//   - When ≥1 row is selected the header swaps to a contextual action bar
//     ("Delete N rows | Cancel selection") — same pattern Supabase Studio uses
//   - Insert is a modal with all columns
//   - No per-row action buttons (no pencil, no trash) — selection covers delete,
//     inline cell click covers edit
export function TableEditor({ projectId }: TableEditorProps) {
  const t = useTranslations('projects.tables');
  const [tables, setTables] = useState<TableSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [selectedPks, setSelectedPks] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadTables = async () => {
    const res = await fetch(`/api/projects/${projectId}/tables`);
    const body = (await res.json()) as { tables?: TableSummary[] };
    setTables(body.tables ?? []);
  };

  const loadDetail = async (tableName: string) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/projects/${projectId}/tables/${tableName}`);
    const body = (await res.json()) as TableDetail;
    setDetail(body);
    setLoadingDetail(false);
    setSelectedPks(new Set());
  };

  useEffect(() => {
    void loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-select the first table once the list arrives.
  useEffect(() => {
    if (tables && tables.length > 0 && selected === null) {
      setSelected(tables[0].name);
    }
  }, [tables, selected]);

  useEffect(() => {
    if (!selected) return;
    void loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selected]);

  // Single-cell PATCH used by the inline EditableCell. Throws on failure so
  // the popover surfaces the server's error message.
  const onSaveCell = async (
    pk: string,
    columnName: string,
    newValue: string | null,
  ) => {
    if (!selected) return;
    const res = await fetch(
      `/api/projects/${projectId}/tables/${selected}/rows/${pk}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { [columnName]: newValue } }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? 'Update failed');
    }
    await loadDetail(selected);
  };

  const onBulkDelete = async () => {
    if (!selected || selectedPks.size === 0) return;
    setBulkDeleting(true);
    try {
      // Delete sequentially. The endpoint is idempotent so partial failures
      // leave the rest of the rows in a consistent state.
      for (const pk of selectedPks) {
        await fetch(`/api/projects/${projectId}/tables/${selected}/rows/${pk}`, {
          method: 'DELETE',
        });
      }
      await loadDetail(selected);
      await loadTables();
    } finally {
      setBulkDeleting(false);
    }
  };

  const pkColumn = detail?.columns.find((c) => c.isPrimaryKey)?.name;

  // All visible PKs — used by the "select all" checkbox.
  const allPks = useMemo(() => {
    if (!detail || !pkColumn) return [] as string[];
    return detail.rows
      .map((r) => r[pkColumn])
      .filter((v): v is string | number => v !== null && v !== undefined)
      .map((v) => String(v));
  }, [detail, pkColumn]);

  const allSelected = allPks.length > 0 && selectedPks.size === allPks.length;
  const someSelected = selectedPks.size > 0 && !allSelected;

  const togglePk = (pk: string) => {
    setSelectedPks((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedPks((prev) => (prev.size === allPks.length ? new Set() : new Set(allPks)));
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left rail — table list */}
        <aside className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xl shadow-black/30 backdrop-blur-xl">
          <header className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
            <Database className="size-4 text-[color:var(--color-brand-from)]" />
            <h2 className="text-sm font-semibold text-foreground">public</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {tables?.length ?? 0}
            </span>
          </header>

          {tables === null ? (
            <div className="flex items-center justify-center px-4 py-8 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              {t('loading')}
            </div>
          ) : tables.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {t('noTables')}
            </div>
          ) : (
            <ul className="max-h-[480px] divide-y divide-border/30 overflow-y-auto">
              {tables.map((table) => (
                <li key={table.name}>
                  <button
                    type="button"
                    onClick={() => setSelected(table.name)}
                    className={cn(
                      'flex w-full items-start gap-2 px-4 py-3 text-left transition-colors',
                      selected === table.name
                        ? 'bg-[color:var(--color-brand-from)]/10 text-foreground'
                        : 'text-muted-foreground hover:bg-card/40 hover:text-foreground',
                    )}
                  >
                    <TableIcon
                      className={cn(
                        'mt-0.5 size-3.5 shrink-0',
                        selected === table.name
                          ? 'text-[color:var(--color-brand-from)]'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-semibold">{table.name}</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {t('rowCount', { count: table.rowCount })} ·{' '}
                        {t('columnCount', { count: table.columnCount })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Right pane — selected table */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {!selected || !detail ? (
            loadingDetail ? (
              <div className="flex items-center justify-center px-6 py-20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t('loading')}
              </div>
            ) : (
              <div className="px-6 py-20 text-center text-sm text-muted-foreground">
                {t('noTables')}
              </div>
            )
          ) : (
            <>
              {/* Header swaps between the default state and a bulk-action bar
                  when at least one row is checked — same pattern as Studio. */}
              {selectedPks.size > 0 ? (
                <header className="flex items-center justify-between border-b border-border/40 bg-[color:var(--color-brand-from)]/[0.04] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {t('selectedCount', { count: selectedPks.size })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPks(new Set())}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {t('clearSelection')}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBulkDelete}
                    disabled={bulkDeleting}
                    className="border-red-500/40 text-red-300 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t('deleteSelected', { count: selectedPks.size })}
                  </Button>
                </header>
              ) : (
                <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                  <div>
                    <h2 className="font-mono text-sm font-semibold text-foreground">
                      {detail.schema}.{detail.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t('showingRows', { count: detail.rows.length })} · total {detail.totalRows}
                    </p>
                  </div>
                  <Button variant="brand" size="sm" onClick={() => setInsertOpen(true)}>
                    <Plus className="size-3.5" />
                    {t('insertRow')}
                  </Button>
                </header>
              )}

              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-max border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl">
                    <tr>
                      {/* Checkbox column — sticky-left so it never disappears */}
                      <th className="sticky left-0 z-30 w-10 border-b border-r border-border/40 bg-background/95 px-3 py-2.5 text-center backdrop-blur-xl">
                        {pkColumn && (
                          <Checkbox
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={toggleAll}
                            aria-label="Select all rows"
                          />
                        )}
                      </th>
                      {detail.columns.map((col, idx) => (
                        <th
                          key={col.name}
                          className={cn(
                            'border-b border-border/40 px-4 py-2.5 text-left',
                            // Frozen first data column (the PK) stays visible
                            // when scrolling horizontally on wide tables.
                            idx === 0 &&
                              'sticky left-10 z-30 border-r border-border/40 bg-background/95 backdrop-blur-xl',
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            {col.isPrimaryKey && (
                              <Key className="size-3 text-[color:var(--color-brand-from)]" />
                            )}
                            <span className="font-mono font-semibold text-foreground">
                              {col.name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[0.625rem] font-normal uppercase tracking-wider text-muted-foreground">
                            {col.dataType}
                            {col.isNullable ? '' : ' · NOT NULL'}
                          </p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={detail.columns.length + 1}
                          className="px-4 py-12 text-center text-xs text-muted-foreground"
                        >
                          {t('rowCount', { count: 0 })}
                        </td>
                      </tr>
                    ) : (
                      detail.rows.map((row, i) => {
                        const pk = pkColumn ? String(row[pkColumn] ?? '') : null;
                        const isSelected = pk ? selectedPks.has(pk) : false;
                        return (
                          <tr
                            key={pk ?? i}
                            className={cn(
                              'group transition-colors',
                              isSelected
                                ? 'bg-[color:var(--color-brand-from)]/[0.06]'
                                : 'hover:bg-card/40',
                            )}
                          >
                            {/* Checkbox cell */}
                            <td
                              className={cn(
                                'sticky left-0 z-10 w-10 border-b border-r border-border/30 px-3 py-2 text-center backdrop-blur-xl',
                                isSelected
                                  ? 'bg-[color:var(--color-brand-from)]/[0.08]'
                                  : 'bg-card/90 group-hover:bg-card',
                              )}
                            >
                              {pk && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => togglePk(pk)}
                                  aria-label={`Select row ${pk}`}
                                />
                              )}
                            </td>
                            {detail.columns.map((col, idx) => (
                              <td
                                key={col.name}
                                className={cn(
                                  'border-b border-border/30 px-4 py-2',
                                  // Frozen first data column needs an opaque
                                  // background so cells underneath don't bleed.
                                  idx === 0 &&
                                    cn(
                                      'sticky left-10 z-10 border-r border-border/30 backdrop-blur-xl',
                                      isSelected
                                        ? 'bg-[color:var(--color-brand-from)]/[0.08]'
                                        : 'bg-card/90 group-hover:bg-card',
                                    ),
                                )}
                              >
                                {pk ? (
                                  <EditableCell
                                    column={col}
                                    value={row[col.name]}
                                    onSave={(newValue) => onSaveCell(pk, col.name, newValue)}
                                  />
                                ) : (
                                  <span
                                    className={cn(
                                      'block max-w-[360px] truncate font-mono',
                                      row[col.name] === null
                                        ? 'text-muted-foreground/60'
                                        : 'text-foreground/90',
                                    )}
                                  >
                                    {formatCell(row[col.name])}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {detail && insertOpen && (
        <InsertRowDialog
          tableName={detail.name}
          columns={detail.columns}
          projectId={projectId}
          onClose={() => setInsertOpen(false)}
          onInserted={async () => {
            setInsertOpen(false);
            await loadDetail(detail.name);
            await loadTables();
          }}
        />
      )}
    </>
  );
}

interface InsertRowDialogProps {
  projectId: string;
  tableName: string;
  columns: TableColumn[];
  onClose: () => void;
  onInserted: () => Promise<void> | void;
}

// Modal with one input per column for inserting a new row. Mirrors the
// "Insert" button in Supabase Studio which opens a side panel — we use a
// modal because it fits the SubterraDB design language better.
function InsertRowDialog({
  projectId,
  tableName,
  columns,
  onClose,
  onInserted,
}: InsertRowDialogProps) {
  const t = useTranslations('projects.tables');
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tables/${tableName}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Insert failed');
        setSubmitting(false);
        return;
      }
      await onInserted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('insertRowTitle', { table: tableName })}</DialogTitle>
          <DialogDescription>{t('insertRowDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {columns.map((col) => (
              <div key={col.name} className="space-y-1.5">
                <Label htmlFor={`col-${col.name}`} className="flex items-center gap-1.5">
                  {col.isPrimaryKey && (
                    <Key className="size-3 text-[color:var(--color-brand-from)]" />
                  )}
                  <span className="font-mono">{col.name}</span>
                  <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {col.dataType}
                    {col.isNullable ? '' : ' · NOT NULL'}
                  </span>
                </Label>
                <Input
                  id={`col-${col.name}`}
                  value={values[col.name] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                  }
                  placeholder={col.isNullable ? t('emptyForNull') : t('value')}
                  className="font-mono"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <pre className="whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('inserting')}
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  {t('insertRow')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
