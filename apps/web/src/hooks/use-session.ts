'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { hasAnyPermission, hasPermission, type FeatureKey, type Permission } from '@solar/shared';
import { api } from '@/lib/api-client';
import type { Session } from '@/lib/types';
import { SessionContext } from '@/providers/session-provider';

/** The signed-in session. Only valid below `<SessionProvider>` (authenticated layouts). */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}

export function usePermission(permission: Permission | Permission[]): boolean {
  return hasPermission(useSession().permissions, permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  return hasAnyPermission(useSession().permissions, permissions);
}

export function useFeature(key: FeatureKey): boolean {
  return useSession().features?.[key] ?? false;
}

export interface Gate {
  permission?: Permission | Permission[];
  anyPermission?: Permission[];
  feature?: FeatureKey;
}

/** Pure check used by nav filtering and `<Can>`. */
export function allows(session: Session, gate: Gate): boolean {
  if (gate.permission && !hasPermission(session.permissions, gate.permission)) return false;
  if (gate.anyPermission && !hasAnyPermission(session.permissions, gate.anyPermission)) return false;
  if (gate.feature && !session.features?.[gate.feature]) return false;
  return true;
}

export function useCan(gate: Gate): boolean {
  return allows(useSession(), gate);
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/auth/logout'),
    onSettled: () => {
      client.clear();
      // Full reload on purpose: drops every in-memory cache and module state from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
    meta: { skipErrorToast: true },
  });
}
