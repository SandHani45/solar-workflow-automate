'use client';

import Link from 'next/link';
import { AlertTriangle, Boxes, IndianRupee, Layers } from 'lucide-react';
import { humanize } from '@solar/shared';
import { useInventorySummary } from '@/hooks/api/use-inventory';
import { formatINR, formatINRCompact, formatNumber } from '@/lib/utils';
import { SimpleBarChart } from '@/components/charts/charts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

export default function InventorySummaryPage() {
  const { data, isLoading, error, refetch } = useInventorySummary();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const byCategory = [...(data?.byCategory ?? [])].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stock value" value={formatINRCompact(data?.totalValue)} icon={IndianRupee} tone="green" loading={isLoading} />
        <StatCard label="Items" value={formatNumber(data?.totalItems)} icon={Boxes} loading={isLoading} />
        <StatCard label="Categories" value={byCategory.length} icon={Layers} tone="purple" loading={isLoading} />
        <StatCard label="Low stock" value={data?.lowStock.length ?? 0} icon={AlertTriangle} tone="red" loading={isLoading} emphasis={data && data.lowStock.length > 0 ? 'warning' : undefined} href="/inventory?lowStock=true" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stock value by category" />
          <CardContent>{isLoading ? <Skeleton className="h-60" /> : <SimpleBarChart data={byCategory.map((c) => ({ category: humanize(c.category), value: c.value }))} xKey="category" yKey="value" name="Value" format="inr" layout="vertical" height={Math.max(200, byCategory.length * 36)} />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="By category" />
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                <th className="px-5 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category} className="border-t border-border">
                  <td className="px-5 py-2">{humanize(c.category)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatNumber(c.quantity)}</td>
                  <td className="tabular px-5 py-2 text-right font-medium">{formatINR(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card>
        <CardHeader title="Low stock" description="Available quantity at or below reorder level" />
        {!isLoading && data?.lowStock.length === 0 ? (
          <EmptyState compact title="All stocked up" />
        ) : (
          <ul className="divide-y divide-border">
            {data?.lowStock.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Badge tone="red">Low</Badge>
                <span className="flex-1 truncate">
                  {i.name} <span className="text-xs text-muted-foreground">{i.sku}</span>
                </span>
                <span className="tabular text-muted-foreground">
                  {formatNumber(i.available)} / reorder {formatNumber(i.reorderLevel)} {i.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-5 py-2.5 text-right">
          <Link href="/inventory?lowStock=true" className="text-xs font-medium text-primary dark:text-blue-400">
            Restock items →
          </Link>
        </div>
      </Card>
    </div>
  );
}
