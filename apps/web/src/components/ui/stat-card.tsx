import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type Tone } from '@/lib/status';
import { Skeleton } from './skeleton';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  href,
  loading,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  loading?: boolean;
  /** Highlight (e.g. overdue > 0). */
  emphasis?: 'danger' | 'warning';
}) {
  const body = (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors',
        href && 'hover:border-primary/40 hover:shadow-sm',
        emphasis === 'danger' && 'border-rose-300 dark:border-rose-500/40',
        emphasis === 'warning' && 'border-amber-300 dark:border-amber-500/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex size-8 items-center justify-center rounded-lg', TONE_STYLES[tone].soft, TONE_STYLES[tone].text)}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div>
        {loading ? <Skeleton className="h-7 w-24" /> : <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
