import type { HTMLAttributes } from 'react';
import { humanize } from '@solar/shared';
import { cn } from '@/lib/utils';
import { statusTone, TONE_STYLES, type Tone } from '@/lib/status';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', dot, size = 'sm', className, children, ...props }: BadgeProps) {
  const t = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        t.badge,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

/** Badge for any enum status value, coloured consistently app-wide. */
export function StatusBadge({ status, label, className, size }: { status: string; label?: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={statusTone(status)} dot size={size} className={className}>
      {label ?? humanize(status)}
    </Badge>
  );
}
