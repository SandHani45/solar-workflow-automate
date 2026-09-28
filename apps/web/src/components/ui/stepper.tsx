import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Step {
  key: string;
  label: string;
  description?: ReactNode;
}

/**
 * Horizontal status stepper (dispatch lifecycle, ticket lifecycle). Wraps to a vertical list on
 * very narrow screens.
 */
export function Stepper({ steps, current, failed }: { steps: Step[]; current: string; failed?: boolean }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && i === steps.length - 1 && !failed);
        const active = i === idx;
        return (
          <li key={s.key} className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2 sm:text-center">
            {i > 0 && <span aria-hidden className={cn('absolute top-4 right-1/2 hidden h-0.5 w-full sm:block', i <= idx ? 'bg-primary dark:bg-blue-500' : 'bg-border')} />}
            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                done && 'border-primary bg-primary text-white dark:border-blue-500 dark:bg-blue-500',
                active && !done && (failed ? 'border-destructive bg-destructive text-white' : 'border-primary bg-card text-primary dark:border-blue-400 dark:text-blue-300'),
                !done && !active && 'border-border bg-card text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
              {s.description && <p className="text-[11px] text-muted-foreground">{s.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface TimelineItem {
  id: string;
  title: ReactNode;
  body?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}

/** Vertical activity timeline (audit trail, lead activities, comments). */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {items.map((it) => (
        <li key={it.id} className="relative flex gap-3">
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground [&_svg]:size-3.5">
            {it.icon ?? <span className="size-2 rounded-full bg-primary dark:bg-blue-400" />}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="text-sm">{it.title}</div>
            {it.body && <div className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{it.body}</div>}
            {it.meta && <div className="mt-1 text-xs text-muted-foreground">{it.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
