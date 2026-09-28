'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useExpenses } from '@/hooks/api/use-finance';
import { useCan } from '@/hooks/use-session';
import { formatINR } from '@/lib/utils';
import { ExpenseDialog } from '@/components/finance/expense-dialog';
import { ExpenseTable } from '@/components/finance/expense-table';
import { Button } from '@/components/ui/button';

export function ExpensesTab({ projectId }: { projectId: string }) {
  const canWrite = useCan({ permission: 'expenses:write' });
  const { data, isLoading, error } = useExpenses({ projectId, limit: 100 });
  const [open, setOpen] = useState(false);
  const approved = (data?.data ?? []).filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0);
  const pending = (data?.data ?? []).filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Approved <span className="tabular font-semibold text-foreground">{formatINR(approved)}</span> · pending approval <span className="tabular font-semibold text-foreground">{formatINR(pending)}</span>
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Add expense
          </Button>
        )}
      </div>
      <ExpenseTable data={data?.data} loading={isLoading} error={error} showProject={false} />
      <ExpenseDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </div>
  );
}
