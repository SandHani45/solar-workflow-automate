'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, humanize } from '@solar/shared';
import { useExpenses } from '@/hooks/api/use-finance';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import { Require } from '@/components/auth/require';
import { ExpenseDialog } from '@/components/finance/expense-dialog';
import { ExpenseTable } from '@/components/finance/expense-table';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';

export default function ExpensesPage() {
  return (
    <Require permission="expenses:read" feature="expenses">
      <Expenses />
    </Require>
  );
}

function Expenses() {
  const canWrite = useCan({ permission: 'expenses:write' });
  const canApprove = useCan({ permission: 'expenses:approve' });
  const [params, setParams] = useQueryParams();
  // Approvers land on the approval queue; everyone else sees all their expenses.
  const status = params.get('status') ?? (canApprove ? 'pending' : 'all');
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, isLoading, error } = useExpenses({ status: status === 'all' ? '' : status, category, page, limit: 25, sort: '-incurredAt' });
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          label="Status"
          value={status}
          onChange={(s) => setParams({ status: s, page: null })}
          options={[...(canApprove ? [{ value: 'pending', label: 'Approval queue' }] : []), { value: 'all', label: 'All' }, ...EXPENSE_STATUSES.filter((s) => s !== 'pending' || !canApprove).map((s) => ({ value: s, label: humanize(s) }))]}
        />
        <Select aria-label="Category" className="sm:w-48" placeholder="All categories" value={category} onChange={(e) => setParams({ category: e.target.value, page: null })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
        {canWrite && (
          <Button className="sm:ml-auto" onClick={() => setOpen(true)}>
            <Plus /> Add expense
          </Button>
        )}
      </div>
      <ExpenseTable data={data?.data} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} />
      <ExpenseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
