'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CUSTOMER_TYPES, humanize, LEAD_SOURCES, LEAD_STATUSES, leadSchema } from '@solar/shared';
import type { z } from 'zod';
import { useCreateLead, useUpdateLead } from '@/hooks/api/use-leads';
import { useUserOptions } from '@/hooks/api/use-team';
import { useCan } from '@/hooks/use-session';
import type { Lead } from '@/lib/types';
import { toDateInputValue } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type In = z.input<typeof leadSchema>;
type Out = z.output<typeof leadSchema>;
const empty = (v: unknown) => (v === '' || v === null ? undefined : v);

function defaultsFor(lead?: Lead): In {
  return {
    name: lead?.name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    address: { line1: lead?.address?.line1 ?? '', city: lead?.address?.city ?? '', district: lead?.address?.district ?? '', state: lead?.address?.state ?? '', pincode: lead?.address?.pincode ?? '' },
    customerType: lead?.customerType ?? 'residential',
    source: lead?.source ?? 'phone',
    status: lead?.status ?? 'new',
    monthlyBill: lead?.monthlyBill,
    requiredKw: lead?.requiredKw,
    assignedTo: lead?.assignedTo?.id,
    followUpAt: lead?.followUpAt ? toDateInputValue(lead.followUpAt) : undefined,
    notes: lead?.notes ?? '',
  };
}

export function LeadDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead }) {
  const create = useCreateLead();
  const update = useUpdateLead(lead?.id ?? '');
  const canAssign = useCan({ permission: 'leads:assign' });
  const { data: sales } = useUserOptions(undefined, canAssign && open);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(leadSchema), defaultValues: defaultsFor(lead) });
  const { errors } = form.formState;
  const mutation = lead ? update : create;

  const submit = form.handleSubmit((v) =>
    mutation.mutate(v, {
      onSuccess: () => {
        if (!lead) form.reset(defaultsFor());
        onOpenChange(false);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={lead ? `Edit ${lead.code}` : 'New lead'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {lead ? 'Save lead' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FormField label="Name" error={errors.name} required>
          <Input autoFocus {...form.register('name')} />
        </FormField>
        <FormField label="Phone" error={errors.phone} required>
          <Input type="tel" inputMode="tel" {...form.register('phone')} />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <Input type="email" {...form.register('email')} />
        </FormField>
        <FormField label="City" error={errors.address?.city}>
          <Input {...form.register('address.city')} />
        </FormField>
        <FormField label="Monthly bill" error={errors.monthlyBill} hint="From the electricity bill">
          <CurrencyInput {...form.register('monthlyBill', { setValueAs: empty })} />
        </FormField>
        <FormField label="Required size (kW)" error={errors.requiredKw}>
          <Input type="number" step="0.1" inputMode="decimal" {...form.register('requiredKw', { setValueAs: empty })} />
        </FormField>
        <FormField label="Customer type">
          <Select options={enumOptions(CUSTOMER_TYPES, humanize)} {...form.register('customerType')} />
        </FormField>
        <FormField label="Source">
          <Select options={enumOptions(LEAD_SOURCES, humanize)} {...form.register('source')} />
        </FormField>
        <FormField label="Status">
          <Select options={enumOptions(LEAD_STATUSES, humanize)} {...form.register('status')} />
        </FormField>
        <FormField label="Next follow-up" error={errors.followUpAt}>
          <DateInput {...form.register('followUpAt', { setValueAs: empty })} />
        </FormField>
        {canAssign && (
          <FormField label="Assigned to" className="sm:col-span-2">
            <Select placeholder="Unassigned" options={(sales ?? []).filter((u) => u.roleKey !== 'customer').map((u) => ({ value: u.id, label: u.name }))} {...form.register('assignedTo', { setValueAs: (v) => (v === '' ? null : v) })} />
          </FormField>
        )}
        <FormField label="Notes" className="sm:col-span-2">
          <Textarea {...form.register('notes')} />
        </FormField>
      </form>
    </Dialog>
  );
}
