'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { homeFor, safeNext } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Session } from '@/lib/types';

/** After any successful sign-in: cache the session and route by role (honouring a safe ?next). */
export function useAuthRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  return useCallback(
    (session: Session) => {
      client.setQueryData(qk.session, session);
      const home = homeFor(session);
      const next = safeNext(params.get('next'));
      // Customers and platform admins have a single home; don't send them into staff pages.
      const target = next && home === '/dashboard' ? next : next?.startsWith(home) ? next : home;
      router.replace(target);
    },
    [client, params, router],
  );
}
