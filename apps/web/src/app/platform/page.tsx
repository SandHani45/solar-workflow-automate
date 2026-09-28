'use client';

import Link from 'next/link';
import { Building2, CheckCircle2, FolderKanban, Users } from 'lucide-react';
import { usePlatformOrgs, usePlatformStats } from '@/hooks/api/use-platform';
import { formatDate, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

export default function PlatformOverviewPage() {
  const stats = usePlatformStats();
  const recent = usePlatformOrgs({ limit: 8, sort: '-createdAt' });
  if (stats.error) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  return (
    <>
      <PageHeader title="Platform overview" description="All SolarFlow tenants at a glance." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Organisations" value={formatNumber(s?.orgs)} icon={Building2} loading={stats.isLoading} href="/platform/tenants" />
        <StatCard label="Active organisations" value={formatNumber(s?.activeOrgs)} icon={CheckCircle2} tone="green" loading={stats.isLoading} hint={s && s.orgs ? `${Math.round((s.activeOrgs / s.orgs) * 100)}% active` : undefined} />
        <StatCard label="Users" value={formatNumber(s?.users)} icon={Users} tone="purple" loading={stats.isLoading} />
        <StatCard label="Projects" value={formatNumber(s?.projects)} icon={FolderKanban} tone="amber" loading={stats.isLoading} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Newest tenants" action={<Link href="/platform/tenants" className="text-xs font-medium text-primary dark:text-blue-400">All tenants →</Link>} />
        {recent.isLoading && <Skeleton className="m-4 h-40" />}
        <ul className="divide-y divide-border">
          {recent.data?.data.map((o) => (
            <li key={o.id}>
              <Link href={`/platform/tenants/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.slug} · joined {formatDate(o.createdAt)}
                  </span>
                </span>
                <StatusBadge status={o.plan} />
                <StatusBadge status={o.isActive ? 'active' : 'cancelled'} label={o.isActive ? 'Active' : 'Suspended'} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
