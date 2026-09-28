'use client';

import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { humanize, ORG_PLANS } from '@solar/shared';
import { usePlatformOrgs } from '@/hooks/api/use-platform';
import { useQueryParams } from '@/hooks/use-query-state';
import type { PlatformOrg } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';

export default function TenantsPage() {
  const router = useRouter();
  const [params, setParams] = useQueryParams();
  const filters = { q: params.get('q') ?? '', plan: params.get('plan') ?? '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = usePlatformOrgs({ ...filters, limit: 25 });

  const columns: Column<PlatformOrg>[] = [
    { id: 'name', header: 'Organisation', sortValue: (o) => o.name, cell: (o) => <span><span className="block font-medium">{o.name}</span><span className="text-xs text-muted-foreground">{o.slug}</span></span> },
    { id: 'plan', header: 'Plan', cell: (o) => <StatusBadge status={o.plan} /> },
    { id: 'users', header: 'Users', align: 'right', sortValue: (o) => o.users ?? 0, cell: (o) => formatNumber(o.users) },
    { id: 'projects', header: 'Projects', align: 'right', sortValue: (o) => o.projects ?? 0, cell: (o) => formatNumber(o.projects) },
    { id: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.isActive ? 'active' : 'cancelled'} label={o.isActive ? 'Active' : 'Suspended'} /> },
    { id: 'createdAt', header: 'Joined', sortValue: (o) => o.createdAt, cell: (o) => formatDate(o.createdAt), hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader title="Tenants" description="Organisations using SolarFlow — plans, status and feature entitlements." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search organisation…" />
        <Select aria-label="Plan" className="sm:w-44" placeholder="All plans" value={filters.plan} onChange={(e) => setParams({ plan: e.target.value, page: null })} options={ORG_PLANS.map((p) => ({ value: p, label: humanize(p) }))} />
      </div>
      <DataTable caption="Tenants" columns={columns} data={data?.data} rowKey={(o) => o.id} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} onRowClick={(o) => router.push(`/platform/tenants/${o.id}`)} empty={<EmptyState icon={Building2} title="No tenants" />} />
    </>
  );
}
