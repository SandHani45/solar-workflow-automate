'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, HandCoins, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { advanceSchema, humanize } from '@solar/shared';
import type { z } from 'zod';
import { useAdvances, useCreateAdvance, useSettleAdvance } from '@/hooks/api/use-finance';
import { useCan } from '@/hooks/use-session';
import type { Advance } from '@/lib/types';
import { compact, formatDate, formatINR, toDateInputValue } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';

type In = z.input<typeof advanceSchema>;
type Out = z.output<typeof advanceSchema>;

export default function AdvancesPage() {
  return (
    <Require permission="finance:read">
      <Advances />
    </Require>
  );
}

function Advances() {
  const canManage = useCan({ permission: 'finance:partners' });
  const { data, isLoading, error } = useAdvances();
  const settle = useSettleAdvance();
  const [open, setOpen] = useState(false);
  const rows = data?.data ?? [];
  const outstanding = rows.filter((a) => a.status === 'outstanding');
  const sum = (kind: Advance['kind']) => outstanding.filter((a) => a.kind === kind).reduce((s, a) => s + a.amount, 0);

  const columns: Column<Advance>[] = [
    { id: 'takenAt', header: 'Date', cell: (a) => formatDate(a.takenAt), sortValue: (a) => a.takenAt },
    { id: 'person', header: 'Person', cell: (a) => <span className="font-medium">{a.personName}</span>, sortValue: (a) => a.personName },
    { id: 'kind', header: 'Kind', cell: (a) => humanize(a.kind) },
    { id: 'note', header: 'Note', cell: (a) => <span className="text-muted-foreground">{a.note || '—'}</span>, hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
    { id: 'amount', header: 'Amount', align: 'right', cell: (a) => <span className="tabular font-semibold">{formatINR(a.amount)}</span>, sortValue: (a) => a.amount },
    ...(canManage
      ? [
          {
            id: 'settle',
            header: <span className="sr-only">Settle</span>,
            align: 'right' as const,
            cell: (a: Advance) =>
              a.status === 'outstanding' ? (
                <Button size="sm" variant="outline" onClick={() => settle.mutate(a.id)} disabled={settle.isPending}>
                  <CheckCircle2 /> Settle
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{formatDate(a.settledAt, 'd MMM')}</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Employee advances" value={formatINR(sum('employee'))} tone="teal" loading={isLoading} />
        <StatCard label="Partner advances" value={formatINR(sum('partner'))} tone="purple" loading={isLoading} hint="Netted off in the profit split" />
        {canManage && (
          <div className="col-span-2 flex items-center justify-end lg:col-span-1">
            <Button onClick={() => setOpen(true)}>
              <Plus /> Record advance
            </Button>
          </div>
        )}
      </div>
      <DataTable caption="Advances" columns={columns} data={rows} rowKey={(a) => a.id} loading={isLoading} error={error} empty={<EmptyState icon={HandCoins} title="No advances" description="Money taken in advance by employees or partners." />} />
      <AdvanceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function AdvanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateAdvance();
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(advanceSchema), defaultValues: { personName: '', kind: 'employee', amount: '', takenAt: toDateInputValue(new Date()), note: '' } });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    create.mutate(compact(v) as Out, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record advance"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FormField label="Person" error={errors.personName} required>
          <Input {...form.register('personName')} />
        </FormField>
        <FormField label="Kind">
          <Select options={[{ value: 'employee', label: 'Employee' }, { value: 'partner', label: 'Partner' }]} {...form.register('kind')} />
        </FormField>
        <FormField label="Amount" error={errors.amount} required>
          <CurrencyInput {...form.register('amount')} />
        </FormField>
        <FormField label="Date">
          <DateInput {...form.register('takenAt')} />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <Input {...form.register('note')} />
        </FormField>
      </form>
    </Dialog>
  );
}
