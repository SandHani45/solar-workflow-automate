import type { ReactNode } from 'react';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <Require permission="inventory:read" feature="inventory">
      <PageHeader title="Inventory" description="Warehouse stock, movements and valuation (weighted-average cost)." className="mb-4" />
      <SectionTabs section="/inventory" />
      {children}
    </Require>
  );
}
