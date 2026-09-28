'use client';

import { AlarmClock, CheckCircle2, Timer } from 'lucide-react';
import { formatDistanceToNowStrict, isPast, parseISO } from 'date-fns';
import type { Ticket } from '@/lib/types';
import { cn } from '@/lib/utils';

/** SLA countdown: time left until `dueAt`, red when overdue, green once resolved/closed. */
export function SlaIndicator({ ticket }: { ticket: Pick<Ticket, 'dueAt' | 'status' | 'overdue' | 'resolvedAt'> }) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden /> Met
      </span>
    );
  }
  if (!ticket.dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  const due = parseISO(ticket.dueAt);
  const overdue = ticket.overdue || isPast(due);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap', overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>
      {overdue ? <AlarmClock className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-hidden />}
      {overdue ? `Overdue ${formatDistanceToNowStrict(due)}` : `${formatDistanceToNowStrict(due)} left`}
    </span>
  );
}
