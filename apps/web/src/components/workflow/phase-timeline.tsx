'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PhaseKey } from '@solar/shared';
import { cn } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';
import type { PhaseView } from '@/lib/workflow';

/**
 * Seven-phase progress rail. Each phase shows done/total; the current phase is highlighted.
 * Clicking scrolls to that phase's section (anchors `#phase-<key>`).
 */
export function PhaseTimeline({ phases, current, onSelect }: { phases: PhaseView[]; current: PhaseKey; onSelect?: (key: PhaseKey) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  // On phones the rail scrolls horizontally: bring the current phase into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    const list = listRef.current;
    if (el && list && list.scrollWidth > list.clientWidth) list.scrollLeft = el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2;
  }, [current]);
  return (
    <ol ref={listRef} className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-flow-col sm:auto-cols-fr sm:px-0">
      {phases.map(({ phase, stages, done }) => {
        const complete = done === stages.length;
        const isCurrent = phase.key === current && !complete;
        const t = TONE_STYLES[phase.color];
        const pct = stages.length ? (done / stages.length) * 100 : 0;
        return (
          <li key={phase.key} className="min-w-[132px]">
            <button
              type="button"
              onClick={() => onSelect?.(phase.key)}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex w-full flex-col gap-2 rounded-xl border bg-card p-2.5 text-left transition-shadow hover:shadow-sm',
                isCurrent ? cn('ring-2', t.ring, 'border-transparent') : 'border-border',
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', complete ? 'bg-emerald-500' : t.dot)}>
                  {complete ? <Check className="size-3" strokeWidth={3} /> : phase.order}
                </span>
                <span className="truncate text-xs font-semibold">{phase.name}</span>
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', complete ? 'bg-emerald-500' : t.dot)} style={{ width: `${pct}%` }} />
              </span>
              <span className="tabular text-[11px] text-muted-foreground">
                {done}/{stages.length} stages
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
