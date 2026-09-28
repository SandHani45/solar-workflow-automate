import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ShellSkeleton } from '@/components/layout/shell-skeleton';
import { PageSkeleton } from '@/components/ui/skeleton';
import { SessionProvider } from '@/providers/session-provider';

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <AppShell>
        {/* Pages read search params (tabs, filters); this boundary keeps them client-rendered. */}
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AppShell>
    </SessionProvider>
  );
}
