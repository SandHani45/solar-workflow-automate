import type { ReactNode } from 'react';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Require anyPermission={['settings:manage', 'features:manage', 'workflow:manage']}>
      <PageHeader title="Settings" description="Organisation profile, modules and your project workflow." className="mb-4" />
      <SectionTabs section="/settings" />
      {children}
    </Require>
  );
}
