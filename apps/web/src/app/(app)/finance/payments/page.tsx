'use client';

import Link from 'next/link';
import { Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { humanize, PAYMENT_MODES } from '@solar/shared';
import { usePayments } from '@/hooks/api/use-finance';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { Payment } from '@/lib/types';
import { formatDate, formatINR } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { PaymentDialog } from '@/components/finance/payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DateInput } from '@/components/ui/date-input';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';

export default function PaymentsPage() {
  return (
    <Require permission="payments:read">
      <Payments />
    </Require>
  );
}

function Payments() {
  const canWrite = useCan({ permission: 'payments:write' });
  const [params, setParams] = useQueryParams();
  const filters = { mode: params.get('mode') ?? '', from: params.get('from') ?? '', to: params.get('to') ?? '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = usePayments({ ...filters, limit: 25, sort: '-receivedAt' });
  const [open, setOpen] = useState(false);
  const pageTotal = (data?.data ?? []).reduce((s, p) => s + p.amount, 0);

  const columns: Column<Payment>[] = [
    { id: 'receivedAt', header: 'Date', cell: (p) => formatDate(p.receivedAt), sortValue: (p) => p.receivedAt },
    { id: 'receipt', header: 'Receipt', cell: (p) => <span className="tabular text-xs">{p.receiptNo ?? '—'}</span>, hideOnMobile: true },
    { id: 'project', header: 'Customer', cell: (p) => <Link href={`/projects/${p.projectId}?tab=payments`} className="hover:underline">{p.project?.customerName ?? 'Project'}<span className="block text-xs text-muted-foreground">{p.project?.code}</span></Link> },
    { id: 'type', header: 'Type', cell: (p) => <Badge tone="blue">{humanize(p.type)}</Badge>, hideOnMobile: true },
    { id: 'mode', header: 'Mode', cell: (p) => humanize(p.mode) },
    { id: 'reference', header: 'Reference', cell: (p) => <span className="text-muted-foreground">{p.reference || '—'}</span>, hideOnMobile: true },
    { id: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="tabular font-semibold">{formatINR(p.amount)}</span>, sortValue: (p) => p.amount },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select aria-label="Mode" className="sm:w-48" placeholder="All modes" value={filters.mode} onChange={(e) => setParams({ mode: e.target.value, page: null })} options={PAYMENT_MODES.map((m) => ({ value: m, label: humanize(m) }))} />
        <DateInput aria-label="From" className="sm:w-40" value={filters.from} onChange={(e) => setParams({ from: e.target.value, page: null })} />
        <DateInput aria-label="To" className="sm:w-40" value={filters.to} onChange={(e) => setParams({ to: e.target.value, page: null })} />
        <p className="text-xs text-muted-foreground sm:ml-2">
          Page total <span className="tabular font-semibold text-foreground">{formatINR(pageTotal)}</span>
        </p>
        {canWrite && (
          <Button className="sm:ml-auto" onClick={() => setOpen(true)}>
            <Plus /> Record payment
          </Button>
        )}
      </div>
      <DataTable caption="Payments" columns={columns} data={data?.data} rowKey={(p) => p.id} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} empty={<EmptyState icon={Wallet} title="No payments" />} />
      <PaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
