'use client';

import type { Dispatch, ListMeta } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Truck } from 'lucide-react';

export function DispatchTable({
  data,
  loading,
  error,
  meta,
  onPageChange,
  onOpen,
  showProject = true,
}: {
  data: Dispatch[] | undefined;
  loading?: boolean;
  error?: unknown;
  meta?: ListMeta;
  onPageChange?: (p: number) => void;
  onOpen: (d: Dispatch) => void;
  showProject?: boolean;
}) {
  const columns: Column<Dispatch>[] = [
    { id: 'code', header: 'Dispatch', cell: (d) => <span className="font-medium">{d.code}</span>, sortValue: (d) => d.code },
    ...(showProject ? [{ id: 'project', header: 'Project', cell: (d: Dispatch) => <span>{d.project?.code} <span className="text-muted-foreground">{d.project?.customerName}</span></span> }] : []),
    { id: 'scheduledDate', header: 'Scheduled', cell: (d) => formatDate(d.scheduledDate), sortValue: (d) => d.scheduledDate },
    { id: 'items', header: 'Items', cell: (d) => d.items.length, align: 'right', hideOnMobile: true },
    { id: 'vehicle', header: 'Vehicle', cell: (d) => d.vehicleNo || '—', hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      rowKey={(d) => d.id}
      loading={loading}
      error={error}
      meta={meta}
      onPageChange={onPageChange}
      onRowClick={onOpen}
      empty={<EmptyState compact icon={Truck} title="No dispatches" description="Plan a dispatch from a project's BOQ." />}
    />
  );
}
