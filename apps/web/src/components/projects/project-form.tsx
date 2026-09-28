'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { CONNECTION_TYPES, CUSTOMER_TYPES, humanize, projectSchema } from '@solar/shared';
import type { z } from 'zod';
import { useUserOptions } from '@/hooks/api/use-team';
import { useCan } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type ProjectFormIn = z.input<typeof projectSchema>;
export type ProjectFormOut = z.output<typeof projectSchema>;

const empty = (v: unknown) => (v === '' || v === null ? undefined : v);

function TeamSelect({ role, label, reg }: { role: string; label: string; reg: UseFormRegisterReturn }) {
  const { data } = useUserOptions(role);
  return (
    <FormField label={label}>
      <Select placeholder="Not assigned" options={(data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...reg} />
    </FormField>
  );
}

/** Create / edit project. Sections collapse to one column on phones. */
export function ProjectForm({ defaultValues, onSubmit, submitting, submitLabel }: { defaultValues: ProjectFormIn; onSubmit: (v: ProjectFormOut) => void; submitting?: boolean; submitLabel: string }) {
  const canAssign = useCan({ permission: 'projects:assign' });
  const form = useForm<ProjectFormIn, unknown, ProjectFormOut>({ resolver: zodResolver(projectSchema), defaultValues });
  const { errors } = form.formState;
  const r = form.register;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Card>
        <CardHeader title="Customer" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Customer name" error={errors.customer?.name} required>
            <Input autoComplete="off" {...r('customer.name')} />
          </FormField>
          <FormField label="Phone" error={errors.customer?.phone} required>
            <Input type="tel" inputMode="tel" {...r('customer.phone')} />
          </FormField>
          <FormField label="Email" error={errors.customer?.email} hint="Needed for customer portal access">
            <Input type="email" {...r('customer.email')} />
          </FormField>
          <FormField label="Electricity consumer number" error={errors.customer?.consumerNumber}>
            <Input {...r('customer.consumerNumber', { setValueAs: empty })} />
          </FormField>
          <FormField label="Address" className="sm:col-span-2">
            <Input placeholder="House / street" {...r('customer.address.line1')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
            <FormField label="City">
              <Input {...r('customer.address.city')} />
            </FormField>
            <FormField label="District">
              <Input {...r('customer.address.district')} />
            </FormField>
            <FormField label="State">
              <Input {...r('customer.address.state')} />
            </FormField>
            <FormField label="PIN code">
              <Input inputMode="numeric" {...r('customer.address.pincode')} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="System & contract" />
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField label="System size (kW)" error={errors.systemSizeKw} required>
            <Input type="number" step="0.01" inputMode="decimal" {...r('systemSizeKw')} />
          </FormField>
          <FormField label="Contract value" error={errors.contractValue} hint="Can be set later at order gain">
            <CurrencyInput {...r('contractValue')} />
          </FormField>
          <FormField label="Expected subsidy" error={errors.expectedSubsidy}>
            <CurrencyInput {...r('expectedSubsidy', { setValueAs: empty })} />
          </FormField>
          <FormField label="Customer type">
            <Select options={enumOptions(CUSTOMER_TYPES, humanize)} {...r('customerType')} />
          </FormField>
          <FormField label="Connection type">
            <Select options={enumOptions(CONNECTION_TYPES, humanize)} {...r('connectionType')} />
          </FormField>
          <FormField label="Target completion">
            <Input type="date" {...r('targetCompletionDate', { setValueAs: empty })} />
          </FormField>
          <FormField label="Notes" className="sm:col-span-3">
            <Textarea {...r('notes')} />
          </FormField>
        </CardContent>
      </Card>

      {canAssign && (
        <Card>
          <CardHeader title="Team" description="People can also be assigned per stage later." />
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TeamSelect role="sales" label="Sales" reg={r('team.salesId', { setValueAs: empty })} />
            <TeamSelect role="manager" label="Project manager" reg={r('team.managerId', { setValueAs: empty })} />
            <TeamSelect role="engineer" label="Engineer" reg={r('team.engineerId', { setValueAs: empty })} />
            <TeamSelect role="operations" label="Operations" reg={r('team.operationsId', { setValueAs: empty })} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
