'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useEffect, type ReactNode } from 'react';
import { fetchSession } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Session } from '@/lib/types';
import { ErrorState } from '@/components/ui/error-state';

export const SessionContext = createContext<Session | null>(null);

export function useSessionQuery() {
  return useQuery({ queryKey: qk.session, queryFn: fetchSession, staleTime: 5 * 60_000 });
}

/**
 * Guards authenticated areas: loads `/auth/me` (refreshing once if needed), redirects to /login when
 * signed out, and exposes the session to `useSession()` for everything below.
 */
export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const query = useSessionQuery();
  const router = useRouter();
  const pathname = usePathname();
  const signedOut = query.isSuccess && query.data === null;

  useEffect(() => {
    if (signedOut) router.replace(`/login?reauth=1&next=${encodeURIComponent(pathname)}`);
  }, [signedOut, router, pathname]);

  if (query.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (!query.data) return <>{fallback}</>;
  return <SessionContext.Provider value={query.data}>{children}</SessionContext.Provider>;
}
