import type { ReactNode } from 'react';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function TeamLayout({ children }: { children: ReactNode }) {
  return (
    <Require anyPermission={['users:read', 'roles:manage']}>
      <PageHeader title="Team" description="People, roles and what each role is allowed to do." className="mb-4" />
      <SectionTabs section="/team" />
      {children}
    </Require>
  );
}
