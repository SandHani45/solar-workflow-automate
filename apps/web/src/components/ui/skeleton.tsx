import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ThinkingOrbs } from '@/components/effects';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Generic page placeholder: header + KPI row + content block. */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="relative space-y-6" role="status" aria-label="Loading">
      <ThinkingOrbs size={36} label={null} className="absolute top-0 right-0" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
