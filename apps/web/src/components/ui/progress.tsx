import { cn } from '@/lib/utils';

export function Progress({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label ?? 'Progress'}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full bg-gradient-to-r from-primary to-blue-500 transition-[width] duration-500', barClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}
