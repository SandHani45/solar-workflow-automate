'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { humanize } from '@solar/shared';
import { useDeletePayment } from '@/hooks/api/use-finance';
import { useProjectFinancials } from '@/hooks/api/use-projects';
import { useCan } from '@/hooks/use-session';
import type { Expense, Payment, Project, ProjectFinancials } from '@/lib/types';
import { formatDate, formatINR } from '@/lib/utils';
import { PaymentDialog } from '@/components/finance/payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';

export function financialsExpenseTotal(f: ProjectFinancials | undefined): number | undefined {
  if (!f || f.expenses === undefined) return undefined;
  return Array.isArray(f.expenses) ? f.expenses.filter((e: Expense) => e.status === 'approved').reduce((s, e) => s + e.amount, 0) : f.expenses;
}

export function PaymentsTab({ project }: { project: Project }) {
  const canWrite = useCan({ permission: 'payments:write' });
  const canFinance = useCan({ permission: 'finance:read' });
  const { data, isLoading, error, refetch } = useProjectFinancials(project.id);
  const remove = useDeletePayment();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Payment | null>(null);

  const contract = data?.contractValue ?? project.contractValue;
  const received = data?.received ?? project.financialSummary?.received ?? 0;
  const pct = contract ? Math.min(100, (received / contract) * 100) : 0;

  const columns: Column<Payment>[] = [
    { id: 'receivedAt', header: 'Date', cell: (p) => formatDate(p.receivedAt), sortValue: (p) => p.receivedAt },
    { id: 'receiptNo', header: 'Receipt', cell: (p) => <span className="tabular text-xs">{p.receiptNo ?? '—'}</span> },
    { id: 'type', header: 'Type', cell: (p) => <Badge tone="blue">{humanize(p.type)}</Badge> },
    { id: 'mode', header: 'Mode', cell: (p) => humanize(p.mode), hideOnMobile: true },
    { id: 'reference', header: 'Reference', cell: (p) => <span className="text-muted-foreground">{p.reference || '—'}</span>, hideOnMobile: true },
    { id: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="tabular font-medium">{formatINR(p.amount)}</span>, sortValue: (p) => p.amount },
    ...(canWrite
      ? [{ id: 'actions', header: <span className="sr-only">Actions</span>, align: 'right' as const, cell: (p: Payment) => <Button variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => setToDelete(p)}><Trash2 /></Button> }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contract value" value={formatINR(contract)} loading={isLoading} />
        <StatCard label="Received" value={formatINR(received)} tone="green" loading={isLoading} hint={`${Math.round(pct)}% collected`} />
        <StatCard label="Pending" value={formatINR(data?.pending ?? Math.max(0, contract - received))} tone="amber" loading={isLoading} />
        {canFinance && data?.profit !== undefined ? (
          <StatCard label="Profit so far" value={formatINR(data.profit)} tone={data.profit >= 0 ? 'green' : 'red'} hint={`Expenses ${formatINR(financialsExpenseTotal(data))} · material ${formatINR(data.materialCost)}`} />
        ) : (
          <StatCard label="Payments" value={data?.payments.length ?? 0} loading={isLoading} />
        )}
      </div>
      <Progress value={pct} label="Collected" barClassName="from-emerald-500 to-emerald-400" />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Payments received</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Record payment
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data?.payments}
        rowKey={(p) => p.id}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        empty={<EmptyState compact title="No payments recorded" description="Record the advance when the customer pays." />}
      />
      <PaymentDialog open={open} onOpenChange={setOpen} projectId={project.id} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove this payment?"
        description={toDelete ? `${formatINR(toDelete.amount)} on ${formatDate(toDelete.receivedAt)} — this is audited.` : undefined}
        destructive
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}
