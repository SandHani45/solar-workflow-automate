import { Ban, CheckCircle2, Circle, CircleDot, Lock, SkipForward } from 'lucide-react';
import type { StageStatus } from '@solar/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { statusTone } from '@/lib/status';

const ICONS = { locked: Lock, pending: Circle, in_progress: CircleDot, blocked: Ban, completed: CheckCircle2, skipped: SkipForward } as const;
const LABELS: Record<StageStatus, string> = { locked: 'Locked', pending: 'Ready', in_progress: 'In progress', blocked: 'Blocked', completed: 'Completed', skipped: 'Skipped' };

export function StageStatusIcon({ status, className }: { status: StageStatus; className?: string }) {
  const Icon = ICONS[status];
  return (
    <Icon
      aria-hidden
      className={cn(
        'size-4 shrink-0',
        status === 'completed' && 'text-emerald-500',
        status === 'in_progress' && 'text-blue-500',
        status === 'blocked' && 'text-rose-500',
        status === 'pending' && 'text-amber-500',
        (status === 'locked' || status === 'skipped') && 'text-muted-foreground',
        className,
      )}
    />
  );
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <Badge tone={statusTone(status)}>
      <StageStatusIcon status={status} className="size-3 text-current" />
      {LABELS[status]}
    </Badge>
  );
}

export function stageStatusLabel(status: StageStatus): string {
  return LABELS[status];
}
