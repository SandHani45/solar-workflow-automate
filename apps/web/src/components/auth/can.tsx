'use client';

import type { ReactNode } from 'react';
import { useCan, type Gate } from '@/hooks/use-session';

/** Renders children only when the session passes the permission / feature gate. */
export function Can({ children, fallback = null, ...gate }: Gate & { children: ReactNode; fallback?: ReactNode }) {
  return useCan(gate) ? <>{children}</> : <>{fallback}</>;
}
