'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useMovements } from '@/hooks/api/use-inventory';
import { useQueryParams } from '@/hooks/use-query-state';
import type { StockMovement } from '@/lib/types';
import { formatDateTime, formatINR, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

const SIGN: Record<string, string> = { in: '+', return: '+', out: '−', adjust: '±' };

export default function MovementsPage() {
  const [params, setParams] = useQueryParams();
  const page = Number(params.get('page') ?? 1);
  const { data, isLoading, error } = useMovements({ page, limit: 30, sort: '-createdAt', itemId: params.get('itemId') ?? undefined });

  const columns: Column<StockMovement>[] = [
    { id: 'createdAt', header: 'When', cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.createdAt)}</span> },
    { id: 'item', header: 'Item', cell: (m) => <span>{m.item?.name ?? m.itemId}<span className="block text-xs text-muted-foreground">{m.item?.sku}</span></span> },
    { id: 'type', header: 'Type', cell: (m) => <StatusBadge status={m.type} /> },
    { id: 'quantity', header: 'Qty', align: 'right', cell: (m) => <span className="tabular font-medium">{SIGN[m.type]}{formatNumber(m.quantity)}</span> },
    { id: 'unitCost', header: 'Unit cost', align: 'right', cell: (m) => (m.unitCost ? formatINR(m.unitCost) : '—'), hideOnMobile: true },
    { id: 'project', header: 'Project', cell: (m) => m.project?.code ?? '—', hideOnMobile: true },
    { id: 'ref', header: 'Reference', cell: (m) => <span className="text-muted-foreground">{[m.reference, m.note].filter(Boolean).join(' · ') || '—'}</span>, hideOnMobile: true },
    { id: 'by', header: 'By', cell: (m) => m.by?.name ?? '—', hideOnMobile: true },
  ];

  return (
    <DataTable
      caption="Stock movements"
      columns={columns}
      data={data?.data}
      rowKey={(m) => m.id}
      loading={isLoading}
      error={error}
      meta={data?.meta}
      onPageChange={(p) => setParams({ page: String(p) })}
      empty={<EmptyState icon={ArrowLeftRight} title="No movements yet" description="Stock in, dispatches and adjustments are logged here." />}
    />
  );
}
