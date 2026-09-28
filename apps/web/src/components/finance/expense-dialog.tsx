'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { EXPENSE_CATEGORIES, expenseSchema, humanize } from '@solar/shared';
import type { z } from 'zod';
import { useUploadDocument } from '@/hooks/api/use-documents';
import { useCreateExpense } from '@/hooks/api/use-finance';
import { compact, toDateInputValue } from '@/lib/utils';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';
import { useState } from 'react';

type In = z.input<typeof expenseSchema>;
type Out = z.output<typeof expenseSchema>;

/** Record a site/office expense, optionally attaching the bill photo as an `expense_bill` document. */
export function ExpenseDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string }) {
  const create = useCreateExpense();
  const upload = useUploadDocument();
  const [bill, setBill] = useState<File | null>(null);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { projectId: projectId ?? null, category: 'local_bos', amount: '', description: '', vendor: '', incurredAt: toDateInputValue(new Date()), paidBy: 'company' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    create.mutate(compact(v) as Out, {
      onSuccess: (expense) => {
        if (bill) upload.mutate({ file: bill, type: 'expense_bill', expenseId: expense.id, projectId: v.projectId ?? undefined });
        form.reset();
        setBill(null);
        onOpenChange(false);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add expense"
      description="Expenses need approval unless you can approve them yourself."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Submit expense
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!projectId && (
          <FormField label="Project" hint="Leave empty for office / overhead expenses" className="sm:col-span-2" htmlFor="exp-project">
            <Controller control={form.control} name="projectId" render={({ field }) => <ProjectPicker id="exp-project" value={field.value ?? undefined} onChange={(p) => field.onChange(p.id)} />} />
          </FormField>
        )}
        <FormField label="Category" error={errors.category}>
          <Select options={enumOptions(EXPENSE_CATEGORIES, humanize)} {...form.register('category')} />
        </FormField>
        <FormField label="Amount" error={errors.amount} required>
          <CurrencyInput {...form.register('amount')} />
        </FormField>
        <FormField label="Description" error={errors.description} required className="sm:col-span-2">
          <Input placeholder="e.g. MC4 connectors and conduit from local vendor" {...form.register('description')} />
        </FormField>
        <FormField label="Vendor" error={errors.vendor}>
          <Input {...form.register('vendor')} />
        </FormField>
        <FormField label="Date" error={errors.incurredAt}>
          <DateInput {...form.register('incurredAt')} />
        </FormField>
        <FormField label="Paid by" error={errors.paidBy}>
          <Select options={enumOptions(['company', 'employee', 'partner'] as const, humanize)} {...form.register('paidBy')} />
        </FormField>
        <FormField label="Bill photo / PDF" hint="Optional">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setBill(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
        </FormField>
      </form>
    </Dialog>
  );
}
