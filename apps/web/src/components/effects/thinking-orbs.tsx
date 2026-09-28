import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const ORBS = [
  { color: '#3b82f6', duration: '2.6s', delay: '0s' },
  { color: '#f59e0b', duration: '3.4s', delay: '-1.1s' },
  { color: '#06b6d4', duration: '4.2s', delay: '-2.3s' },
];

interface ThinkingOrbsProps {
  size?: number;
  /** Announced to screen readers; pass `null` when a parent already has role="status". */
  label?: string | null;
  className?: string;
}

/** Animated orbs for loading and "working on it" states. */
export function ThinkingOrbs({ size = 40, label = 'Loading', className }: ThinkingOrbsProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className={cn('fx-orbs', className)}
      style={{ '--fx-orbs-size': `${size}px` } as CSSProperties}
    >
      {ORBS.map((o) => (
        <span
          key={o.color}
          style={
            {
              background: o.color,
              '--fx-orb-duration': o.duration,
              '--fx-orb-delay': o.delay,
            } as CSSProperties
          }
        />
      ))}
      <span
        style={{ background: 'radial-gradient(circle, #fff7d6, #fbbf24 60%, transparent 70%)' }}
      />
    </span>
  );
}

/** Centered orbs with a caption, for page and panel loading states. */
export function OrbsLoader({
  caption = 'Loading…',
  className,
}: {
  caption?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-6 text-sm text-muted-foreground',
        className,
      )}
    >
      <ThinkingOrbs size={44} label={null} />
      <span>{caption}</span>
    </div>
  );
}
