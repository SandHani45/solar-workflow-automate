'use client';

import { Lock, PowerOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { hasAnyPermission, hasPermission } from '@solar/shared';
import { useSession, type Gate } from '@/hooks/use-session';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Page-level guard: explains *why* a page is unavailable (missing permission vs disabled feature)
 * instead of rendering a broken page. The API enforces the same rules.
 */
export function Require({ children, permission, anyPermission, feature, superAdmin }: Gate & { children: ReactNode; superAdmin?: boolean }) {
  const session = useSession();
  if (superAdmin && !session.user.isSuperAdmin) {
    return <EmptyState icon={Lock} title="Platform admins only" description="This area is only available to SolarFlow platform administrators." />;
  }
  if (feature && !session.features?.[feature]) {
    return <EmptyState icon={PowerOff} title="Feature not enabled" description="This module is turned off for your organisation or role. An admin can enable it in Settings → Features." />;
  }
  const allowed = (!permission || hasPermission(session.permissions, permission)) && (!anyPermission || hasAnyPermission(session.permissions, anyPermission));
  if (!allowed) {
    return <EmptyState icon={Lock} title="You don't have access" description="Your role doesn't include permission for this page. Ask an admin if you need it." />;
  }
  return <>{children}</>;
}
