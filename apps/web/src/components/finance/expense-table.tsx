'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { humanize } from '@solar/shared';
import { useDecideExpense } from '@/hooks/api/use-finance';
import { useCan } from '@/hooks/use-session';
import type { Expense, ListMeta } from '@/lib/types';
import { formatDate, formatINR } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

/** Expenses with inline approve / reject for users with `expenses:approve`. */
export function ExpenseTable({
  data,
  loading,
  error,
  meta,
  onPageChange,
  showProject = true,
}: {
  data: Expense[] | undefined;
  loading?: boolean;
  error?: unknown;
  meta?: ListMeta;
  onPageChange?: (p: number) => void;
  showProject?: boolean;
}) {
  const canApprove = useCan({ permission: 'expenses:approve' });
  const decide = useDecideExpense();
  const [rejecting, setRejecting] = useState<Expense | null>(null);

  const columns: Column<Expense>[] = [
    { id: 'incurredAt', header: 'Date', cell: (e) => formatDate(e.incurredAt), sortValue: (e) => e.incurredAt },
    { id: 'description', header: 'Description', cell: (e) => <span className="block max-w-72 truncate" title={e.description}>{e.description}</span> },
    ...(showProject ? [{ id: 'project', header: 'Project', cell: (e: Expense) => e.project?.code ?? <span className="text-muted-foreground">Office</span>, hideOnMobile: true }] : []),
    { id: 'category', header: 'Category', cell: (e) => humanize(e.category), hideOnMobile: true },
    { id: 'by', header: 'Submitted by', cell: (e) => e.submittedBy?.name ?? '—', hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
    { id: 'amount', header: 'Amount', align: 'right', cell: (e) => <span className="tabular font-medium">{formatINR(e.amount)}</span>, sortValue: (e) => e.amount },
    ...(canApprove
      ? [
          {
            id: 'decide',
            header: <span className="sr-only">Decision</span>,
            align: 'right' as const,
            cell: (e: Expense) =>
              e.status === 'pending' ? (
                <span className="inline-flex gap-1">
                  <Button size="icon-sm" variant="outline" aria-label="Approve" className="text-emerald-600" disabled={decide.isPending} onClick={() => decide.mutate({ id: e.id, status: 'approved' })}>
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Reject" className="text-rose-600" disabled={decide.isPending} onClick={() => setRejecting(e)}>
                    <X />
                  </Button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable columns={columns} data={data} rowKey={(e) => e.id} loading={loading} error={error} meta={meta} onPageChange={onPageChange} empty={<EmptyState compact title="No expenses" />} />
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject expense"
        description={rejecting ? `${formatINR(rejecting.amount)} · ${rejecting.description}` : undefined}
        reason={{ label: 'Reason', placeholder: 'Bill missing, duplicate…' }}
        confirmLabel="Reject"
        destructive
        loading={decide.isPending}
        onConfirm={(note) => rejecting && decide.mutate({ id: rejecting.id, status: 'rejected', note: note || undefined }, { onSuccess: () => setRejecting(null) })}
      />
    </>
  );
}
