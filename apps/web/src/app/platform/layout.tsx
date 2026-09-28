import { Suspense, type ReactNode } from 'react';
import { Require } from '@/components/auth/require';
import { AppShell } from '@/components/layout/app-shell';
import { ShellSkeleton } from '@/components/layout/shell-skeleton';
import { PageSkeleton } from '@/components/ui/skeleton';
import { SessionProvider } from '@/providers/session-provider';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <AppShell platform>
        <Require superAdmin>
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </Require>
      </AppShell>
    </SessionProvider>
  );
}
