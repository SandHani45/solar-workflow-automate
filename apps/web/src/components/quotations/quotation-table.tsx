'use client';

import { useRouter } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { humanize } from '@solar/shared';
import type { ListMeta, Quotation } from '@/lib/types';
import { formatDate, formatINR, formatKw } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

export function QuotationTable({ data, loading, error, meta, onPageChange, showCustomer = true }: { data: Quotation[] | undefined; loading?: boolean; error?: unknown; meta?: ListMeta; onPageChange?: (p: number) => void; showCustomer?: boolean }) {
  const router = useRouter();
  const columns: Column<Quotation>[] = [
    { id: 'number', header: 'Quotation', cell: (q) => <span className="font-medium">{q.number} <span className="text-xs text-muted-foreground">v{q.version}</span></span>, sortValue: (q) => q.number },
    ...(showCustomer
      ? [{ id: 'customer', header: 'Customer', cell: (q: Quotation) => q.customer?.name ?? q.project?.customerName ?? q.lead?.name ?? '—', sortValue: (q: Quotation) => q.customer?.name ?? '' }]
      : []),
    { id: 'kind', header: 'Kind', cell: (q) => <Badge tone={q.kind === 'final' ? 'purple' : 'neutral'}>{humanize(q.kind)}</Badge>, hideOnMobile: true },
    { id: 'kw', header: 'Size', cell: (q) => formatKw(q.systemSizeKw), hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (q) => <StatusBadge status={q.status} /> },
    { id: 'createdAt', header: 'Created', cell: (q) => formatDate(q.createdAt), sortValue: (q) => q.createdAt, hideOnMobile: true },
    { id: 'total', header: 'Total', align: 'right', cell: (q) => <span className="tabular font-medium">{formatINR(q.grandTotal)}</span>, sortValue: (q) => q.grandTotal },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      rowKey={(q) => q.id}
      loading={loading}
      error={error}
      meta={meta}
      onPageChange={onPageChange}
      onRowClick={(q) => router.push(`/quotations/${q.id}`)}
      empty={<EmptyState compact icon={FileSpreadsheet} title="No quotations yet" />}
    />
  );
}
