import type { ReactNode } from 'react';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <Require anyPermission={['finance:read', 'payments:read', 'expenses:read']}>
      <PageHeader title="Finance" description="Collections, expenses, advances and profit — per project and for the business." className="mb-4" />
      <SectionTabs section="/finance" />
      {children}
    </Require>
  );
}
