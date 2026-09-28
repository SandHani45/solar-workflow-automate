'use client';

import { AlarmClock, CalendarClock, FileCheck2, ListChecks } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { roleShort } from '@/lib/roles';
import { TONE_STYLES, type Tone } from '@/lib/status';
import { isStageOverdue, stageChecklist, type StageView } from '@/lib/workflow';
import { Avatar } from '@/components/ui/avatar';
import { StageStatusBadge } from './stage-status';

export function StageCard({ view, tone, presentDocTypes, onOpen, mine }: { view: StageView; tone: Tone; presentDocTypes: Set<string>; onOpen: () => void; mine?: boolean }) {
  const { def, state } = view;
  const overdue = isStageOverdue(state);
  const checklist = stageChecklist(view);
  const checked = checklist.filter((c) => c.done).length;
  const docsDone = def.requiredDocuments.filter((d) => presentDocTypes.has(d)).length;
  const muted = state.status === 'locked' || state.status === 'skipped';

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`stage-card-${def.key}`}
      className={cn(
        'group flex w-full flex-col gap-2.5 rounded-xl border border-l-4 bg-card p-3.5 text-left shadow-xs transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring',
        TONE_STYLES[tone].border,
        overdue ? 'border-y-rose-300 border-r-rose-300 dark:border-y-rose-500/40 dark:border-r-rose-500/40' : 'border-y-border border-r-border',
        muted && 'opacity-65',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            Step {def.step}
            {def.optional && ' · optional'}
            {mine && <span className="ml-1.5 rounded bg-accent-soft px-1 text-amber-700 dark:text-amber-300">yours</span>}
          </p>
          <p className={cn('mt-0.5 text-sm leading-snug font-semibold', state.status === 'skipped' && 'line-through')}>{def.name}</p>
        </div>
        <StageStatusBadge status={state.status} />
      </div>

      <div className="flex flex-wrap gap-1">
        {def.ownerRoles.map((r) => (
          <span key={r} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {roleShort(r)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {checklist.length > 0 && (
          <span className={cn('inline-flex items-center gap-1', checked === checklist.length && 'text-emerald-600 dark:text-emerald-400')}>
            <ListChecks className="size-3.5" aria-hidden /> {checked}/{checklist.length}
          </span>
        )}
        {def.requiredDocuments.length > 0 && (
          <span className={cn('inline-flex items-center gap-1', docsDone === def.requiredDocuments.length && 'text-emerald-600 dark:text-emerald-400')}>
            <FileCheck2 className="size-3.5" aria-hidden /> {docsDone}/{def.requiredDocuments.length} docs
          </span>
        )}
        {state.dueAt && state.status !== 'completed' && state.status !== 'skipped' && state.status !== 'locked' && (
          <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-rose-600 dark:text-rose-400')}>
            {overdue ? <AlarmClock className="size-3.5" aria-hidden /> : <CalendarClock className="size-3.5" aria-hidden />}
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDate(state.dueAt, 'd MMM')}
          </span>
        )}
        {state.status === 'completed' && state.completedAt && <span>Done {formatDate(state.completedAt, 'd MMM')}</span>}
        {state.assignee && (
          <span className="ml-auto inline-flex items-center gap-1">
            <Avatar name={state.assignee.name} size="xs" />
            <span className="max-w-24 truncate">{state.assignee.name}</span>
          </span>
        )}
      </div>
      {state.status === 'blocked' && state.blockedReason && <p className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{state.blockedReason}</p>}
    </button>
  );
}
