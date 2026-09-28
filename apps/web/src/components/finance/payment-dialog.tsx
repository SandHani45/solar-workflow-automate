'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { humanize, PAYMENT_MODES, PAYMENT_TYPES, paymentSchema } from '@solar/shared';
import type { z } from 'zod';
import { useRecordPayment } from '@/hooks/api/use-finance';
import { compact, toDateInputValue } from '@/lib/utils';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';

type In = z.input<typeof paymentSchema>;
type Out = z.output<typeof paymentSchema>;

export function PaymentDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string }) {
  const record = useRecordPayment();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { projectId: projectId ?? '', amount: '', mode: 'upi', type: 'milestone', receivedAt: toDateInputValue(new Date()), reference: '', note: '' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    record.mutate(compact(v) as Out, {
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
      title="Record payment"
      description="A receipt number is generated automatically."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={record.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!projectId && (
          <FormField label="Project" error={errors.projectId} required className="sm:col-span-2" htmlFor="pay-project">
            <Controller control={form.control} name="projectId" render={({ field }) => <ProjectPicker id="pay-project" value={field.value} onChange={(p) => field.onChange(p.id)} />} />
          </FormField>
        )}
        <FormField label="Amount" error={errors.amount} required>
          <CurrencyInput {...form.register('amount')} autoFocus />
        </FormField>
        <FormField label="Received on" error={errors.receivedAt}>
          <DateInput {...form.register('receivedAt')} />
        </FormField>
        <FormField label="Mode" error={errors.mode}>
          <Select options={enumOptions(PAYMENT_MODES, humanize)} {...form.register('mode')} />
        </FormField>
        <FormField label="Type" error={errors.type}>
          <Select options={enumOptions(PAYMENT_TYPES, humanize)} {...form.register('type')} />
        </FormField>
        <FormField label="Reference / UTR" error={errors.reference} className="sm:col-span-2">
          <Input placeholder="UPI ref, cheque no…" {...form.register('reference')} />
        </FormField>
        <FormField label="Note" error={errors.note} className="sm:col-span-2">
          <Input {...form.register('note')} />
        </FormField>
      </form>
    </Dialog>
  );
}
