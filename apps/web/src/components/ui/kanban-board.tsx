'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type Tone } from '@/lib/status';
import { Skeleton } from './skeleton';

export interface KanbanColumn<T> {
  key: string;
  title: string;
  tone?: Tone;
  items: T[];
  /** Footer / summary line (e.g. total value). */
  summary?: ReactNode;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  itemKey: (item: T) => string;
  renderCard: (item: T, column: KanbanColumn<T>) => ReactNode;
  /** Enables drag & drop between columns. Cards should also expose a keyboard/touch "move" control. */
  onMove?: (item: T, from: string, to: string) => void;
  loading?: boolean;
  emptyLabel?: string;
}

const DRAG_MIME = 'application/x-solarflow-card';

/**
 * Horizontal, scroll-snapping kanban. HTML5 drag & drop on desktop; on touch devices cards should
 * provide a "Move to…" menu (drag & drop isn't available there).
 */
export function KanbanBoard<T>({ columns, itemKey, renderCard, onMove, loading, emptyLabel = 'No items' }: KanbanBoardProps<T>) {
  const [over, setOver] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative scrollbar-thin -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {columns.map((col) => {
        const tone = TONE_STYLES[col.tone ?? 'neutral'];
        return (
          <section
            key={col.key}
            aria-label={col.title}
            className={cn('flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/40 sm:w-72', over === col.key && 'ring-2 ring-primary/40')}
            onDragOver={
              onMove
                ? (e) => {
                    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                    e.preventDefault();
                    setOver(col.key);
                  }
                : undefined
            }
            onDragLeave={onMove ? () => setOver((o) => (o === col.key ? null : o)) : undefined}
            onDrop={
              onMove
                ? (e) => {
                    e.preventDefault();
                    setOver(null);
                    const raw = e.dataTransfer.getData(DRAG_MIME);
                    if (!raw) return;
                    const { id, from } = JSON.parse(raw) as { id: string; from: string };
                    if (from === col.key) return;
                    const item = columns.find((c) => c.key === from)?.items.find((it) => itemKey(it) === id);
                    if (item) onMove(item, from, col.key);
                  }
                : undefined
            }
          >
            <header className={cn('flex items-center justify-between gap-2 rounded-t-xl border-t-[3px] px-3 py-2.5', tone.border)}>
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                <h3 className="truncate text-sm font-semibold">{col.title}</h3>
                <span className="tabular rounded-full bg-card px-1.5 text-xs text-muted-foreground">{col.items.length}</span>
              </div>
              {col.summary && <span className="text-xs text-muted-foreground">{col.summary}</span>}
            </header>
            <div className="flex max-h-[calc(100dvh-16rem)] min-h-24 flex-col gap-2 overflow-y-auto p-2">
              {col.items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>}
              {col.items.map((item) => (
                <div
                  key={itemKey(item)}
                  draggable={!!onMove}
                  onDragStart={onMove ? (e) => e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id: itemKey(item), from: col.key })) : undefined}
                  className={cn(onMove && 'cursor-grab active:cursor-grabbing')}
                >
                  {renderCard(item, col)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
