'use client';

import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { humanize } from '@solar/shared';
import type { ListMeta, Ticket } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SlaIndicator } from './sla-indicator';

export function TicketTable({
  data,
  loading,
  error,
  meta,
  onPageChange,
  showProject = true,
  hrefFor = (t) => `/service/${t.id}`,
}: {
  data: Ticket[] | undefined;
  loading?: boolean;
  error?: unknown;
  meta?: ListMeta;
  onPageChange?: (p: number) => void;
  showProject?: boolean;
  hrefFor?: (t: Ticket) => string;
}) {
  const router = useRouter();
  const columns: Column<Ticket>[] = [
    {
      id: 'subject',
      header: 'Ticket',
      cell: (t) => (
        <div className="max-w-80">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="text-xs text-muted-foreground">
            {t.code} · {humanize(t.category)}
          </p>
        </div>
      ),
      sortValue: (t) => t.code,
    },
    ...(showProject ? [{ id: 'project', header: 'Customer', cell: (t: Ticket) => <span>{t.project?.customerName} <span className="block text-xs text-muted-foreground">{t.project?.code}</span></span>, hideOnMobile: true }] : []),
    { id: 'priority', header: 'Priority', cell: (t) => <StatusBadge status={t.priority} />, sortValue: (t) => ['low', 'medium', 'high', 'critical'].indexOf(t.priority) },
    { id: 'status', header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
    { id: 'sla', header: 'SLA', cell: (t) => <SlaIndicator ticket={t} />, sortValue: (t) => t.dueAt ?? '' },
    { id: 'assignee', header: 'Assignee', cell: (t) => (t.assignee ? <span className="inline-flex items-center gap-1.5"><Avatar name={t.assignee.name} size="xs" />{t.assignee.name}</span> : <span className="text-muted-foreground">Unassigned</span>), hideOnMobile: true },
    { id: 'createdAt', header: 'Raised', cell: (t) => formatDate(t.createdAt, 'd MMM'), sortValue: (t) => t.createdAt, hideOnMobile: true },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      rowKey={(t) => t.id}
      loading={loading}
      error={error}
      meta={meta}
      onPageChange={onPageChange}
      onRowClick={(t) => router.push(hrefFor(t))}
      rowClassName={(t) => (t.overdue && t.status !== 'closed' && t.status !== 'resolved' ? 'bg-rose-50/50 dark:bg-rose-500/5' : undefined)}
      empty={<EmptyState compact icon={Wrench} title="No tickets" description="Service requests from customers and the team appear here." />}
    />
  );
}
