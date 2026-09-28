import { LogoMark } from '@/components/brand/logo';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/** Shown while the session loads, shaped like the real shell to avoid layout jump. */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar p-4 lg:block">
        <div className="mb-6 flex items-center gap-2">
          <LogoMark />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </aside>
      <div className="lg:pl-64">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
