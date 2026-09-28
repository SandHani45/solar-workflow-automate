'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { computeQuotationTotals, humanize, QUOTATION_KINDS, quotationSchema, type QuotationInput } from '@solar/shared';
import type { z } from 'zod';
import { useSession, useCan } from '@/hooks/use-session';
import { formatINR } from '@/lib/utils';
import { ItemPicker } from '@/components/inventory/item-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type QuotationFormIn = z.input<typeof quotationSchema>;

const GST_OPTIONS = [0, 5, 12, 18, 28].map((g) => ({ value: String(g), label: `${g}%` }));

/** Typical rooftop BOM so sales can quote in seconds, then tweak. */
function templateLines(kw: number, gst: number): QuotationFormIn['lines'] {
  const panels = Math.max(1, Math.ceil((kw * 1000) / 545));
  return [
    { description: `Mono PERC bifacial solar module 545 Wp (DCR)`, quantity: panels, unitPrice: 14500, gstPercent: gst },
    { description: `On-grid string inverter ${kw} kW`, quantity: 1, unitPrice: Math.round(kw * 9000), gstPercent: gst },
    { description: 'Hot-dip galvanised mounting structure', quantity: kw, unitPrice: 5500, gstPercent: gst },
    { description: 'DC/AC cables, ACDB/DCDB, earthing & lightning arrestor', quantity: 1, unitPrice: Math.round(kw * 4000), gstPercent: gst },
    { description: 'Installation, commissioning & net-metering liaison', quantity: 1, unitPrice: Math.round(kw * 3500), gstPercent: 18 },
  ];
}

export function QuotationBuilder({ defaultValues, onSubmit, submitting, submitLabel }: { defaultValues: QuotationFormIn; onSubmit: (v: QuotationInput) => void; submitting?: boolean; submitLabel: string }) {
  const session = useSession();
  const canPickStock = useCan({ permission: 'inventory:read', feature: 'inventory' });
  const defaultGst = session.org?.settings.defaultGstPercent ?? 12;
  const form = useForm<QuotationFormIn, unknown, QuotationInput>({ resolver: zodResolver(quotationSchema), defaultValues });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'lines' });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const discount = Number(useWatch({ control: form.control, name: 'discount' }) ?? 0) || 0;
  const kw = Number(useWatch({ control: form.control, name: 'systemSizeKw' })) || 0;
  const numericLines = lines.map((l) => ({ description: String(l?.description ?? ''), quantity: Number(l?.quantity) || 0, unitPrice: Number(l?.unitPrice) || 0, gstPercent: Number(l?.gstPercent ?? 0) || 0 }));
  const totals = computeQuotationTotals(numericLines, discount);
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]" noValidate>
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader title="Quotation" />
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField label="Kind">
              <Select options={enumOptions(QUOTATION_KINDS, humanize)} {...form.register('kind')} />
            </FormField>
            <FormField label="System size (kW)" error={errors.systemSizeKw} required>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register('systemSizeKw')} />
            </FormField>
            <FormField label="Valid until" error={errors.validUntil}>
              <DateInput {...form.register('validUntil', { setValueAs: (v) => (v === '' ? undefined : v) })} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Line items"
            description="GST is calculated per line"
            action={
              <Button type="button" variant="outline" size="sm" disabled={!kw} onClick={() => replace(templateLines(kw, defaultGst))} title={kw ? undefined : 'Enter system size first'}>
                <ListPlus /> Standard template
              </Button>
            }
          />
          {errors.lines?.root?.message || errors.lines?.message ? <p className="px-5 pt-3 text-xs font-medium text-destructive">Add at least one line item</p> : null}
          <ul className="divide-y divide-border">
            {fields.map((f, i) => {
              const l = numericLines[i];
              const amount = l ? l.quantity * l.unitPrice : 0;
              return (
                <li key={f.id} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[1fr_80px_130px_84px_110px_36px] sm:items-start sm:px-5">
                  <FormField error={errors.lines?.[i]?.description} className="col-span-2 sm:col-span-1">
                    <Input aria-label={`Line ${i + 1} description`} placeholder="Description" {...form.register(`lines.${i}.description`)} />
                  </FormField>
                  <Input aria-label={`Line ${i + 1} quantity`} type="number" step="any" min={0} className="text-right" {...form.register(`lines.${i}.quantity`)} />
                  <CurrencyInput aria-label={`Line ${i + 1} unit price`} {...form.register(`lines.${i}.unitPrice`)} />
                  <Select aria-label={`Line ${i + 1} GST`} options={GST_OPTIONS} {...form.register(`lines.${i}.gstPercent`)} />
                  <p className="tabular self-center text-right text-sm font-medium">{formatINR(amount)}</p>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} onClick={() => remove(i)} className="justify-self-end">
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
            {fields.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No lines yet — use the standard template or add items.</li>}
          </ul>
          <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:px-5">
            {canPickStock && (
              <ItemPicker className="sm:max-w-sm" placeholder="Add from inventory…" onPick={(it) => append({ description: it.name, quantity: 1, unitPrice: it.sellPrice || it.costPrice, gstPercent: it.gstPercent, itemId: it.id })} />
            )}
            <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, gstPercent: defaultGst })}>
              <Plus /> Add line
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Terms & notes" />
          <CardContent className="grid gap-4">
            <FormField label="Terms">
              <Textarea rows={4} {...form.register('terms')} />
            </FormField>
            <FormField label="Notes for the customer">
              <Textarea rows={2} {...form.register('notes')} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader title="Summary" />
          <CardContent>
            <dl className="space-y-2 text-sm">
              <SumRow label="Subtotal" value={formatINR(totals.subtotal)} />
              <SumRow label="GST" value={formatINR(totals.gstTotal)} />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="w-36">
                  <CurrencyInput aria-label="Discount" {...form.register('discount')} />
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <dt className="font-semibold">Grand total</dt>
                <dd className="tabular text-xl font-semibold" data-testid="grand-total">
                  {formatINR(totals.grandTotal)}
                </dd>
              </div>
              {kw > 0 && <p className="text-right text-xs text-muted-foreground">{formatINR(totals.grandTotal / kw)} per kW</p>}
            </dl>
            <Button type="submit" className="mt-5 w-full" loading={submitting}>
              {submitLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

export const DEFAULT_TERMS = [
  '50% advance with order, 40% on material delivery, 10% after commissioning.',
  'PM Surya Ghar subsidy is credited directly to the customer’s bank account by the government.',
  'Net-metering charges payable to DISCOM are extra at actuals.',
  'Warranty: 25 years performance on modules, 8 years on inverter, 5 years workmanship.',
].join('\n');
