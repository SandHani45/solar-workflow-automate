'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ListMeta } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Pagination } from './pagination';
import { Skeleton } from './skeleton';

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Enables sorting. Client-side sorting uses this value; server sorting uses `id` as the field. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide on narrow screens to keep tables readable on phones. */
  hideOnMobile?: boolean;
}

export type SortState = { id: string; desc: boolean } | null;

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  meta?: ListMeta;
  onPageChange?: (page: number) => void;
  /** Controlled server-side sort. When omitted, sorting is client-side on the current page. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
  caption?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  empty,
  meta,
  onPageChange,
  sort: controlledSort,
  onSortChange,
  rowClassName,
  className,
  caption,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<SortState>(null);
  const sort = onSortChange ? (controlledSort ?? null) : localSort;

  const rows = useMemo(() => {
    if (!data) return [];
    if (onSortChange || !sort) return data;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return data;
    const get = col.sortValue;
    return [...data].sort((a, b) => {
      const av = get(a) ?? '';
      const bv = get(b) ?? '';
      const r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'en', { numeric: true });
      return sort.desc ? -r : r;
    });
  }, [data, sort, columns, onSortChange]);

  const toggleSort = (id: string) => {
    const next: SortState = sort?.id !== id ? { id, desc: false } : sort.desc ? null : { id, desc: true };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  const alignClass = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-xs', className)}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((c) => {
                const sorted = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={sorted ? (sort.desc ? 'descending' : 'ascending') : undefined}
                    className={cn('h-10 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4', alignClass(c.align), c.hideOnMobile && 'hidden md:table-cell', c.className)}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        className={cn('inline-flex items-center gap-1 rounded hover:text-foreground', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        {sorted ? sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  {columns.map((c) => (
                    <td key={c.id} className={cn('px-3 py-3 first:pl-4 last:pr-4', c.hideOnMobile && 'hidden md:table-cell')}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.id} className={cn('px-3 py-2.5 align-middle first:pl-4 last:pr-4', alignClass(c.align), c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && error != null && <ErrorState error={error} onRetry={onRetry} />}
      {!loading && error == null && rows.length === 0 && (empty ?? <EmptyState title="Nothing here yet" compact />)}
      {meta && onPageChange && meta.pages > 1 && (
        <div className="border-t border-border px-3">
          <Pagination meta={meta} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
