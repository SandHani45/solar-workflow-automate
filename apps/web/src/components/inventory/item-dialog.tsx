'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { humanize, ITEM_CATEGORIES, itemSchema, type ItemInput } from '@solar/shared';
import type { z } from 'zod';
import { useSaveItem } from '@/hooks/api/use-inventory';
import type { InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { enumOptions, Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function ItemDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: InventoryItem }) {
  const save = useSaveItem(item?.id);
  const form = useForm<z.input<typeof itemSchema>, unknown, ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: item
      ? { sku: item.sku, name: item.name, category: item.category, brand: item.brand ?? '', unit: item.unit, costPrice: item.costPrice, sellPrice: item.sellPrice, reorderLevel: item.reorderLevel, gstPercent: item.gstPercent, specs: item.specs ?? '' }
      : { sku: '', name: '', category: 'module', brand: '', unit: 'nos', costPrice: '', sellPrice: '', reorderLevel: 0, gstPercent: 12, specs: '' },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) => save.mutate(v, { onSuccess: () => onOpenChange(false) }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={item ? `Edit ${item.name}` : 'Add item'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {item ? 'Save item' : 'Add item'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FormField label="Name" error={errors.name} required className="sm:col-span-2">
          <Input placeholder="e.g. Waaree 545Wp Mono PERC bifacial" {...form.register('name')} />
        </FormField>
        <FormField label="SKU" error={errors.sku} required>
          <Input {...form.register('sku')} />
        </FormField>
        <FormField label="Category" error={errors.category}>
          <Select options={enumOptions(ITEM_CATEGORIES, humanize)} {...form.register('category')} />
        </FormField>
        <FormField label="Brand" error={errors.brand}>
          <Input {...form.register('brand')} />
        </FormField>
        <FormField label="Unit" error={errors.unit}>
          <Input placeholder="nos, m, kg, set" {...form.register('unit')} />
        </FormField>
        <FormField label="Cost price" error={errors.costPrice} hint={item ? 'Updated automatically by stock-in (weighted average)' : undefined}>
          <CurrencyInput {...form.register('costPrice')} />
        </FormField>
        <FormField label="Selling price" error={errors.sellPrice}>
          <CurrencyInput {...form.register('sellPrice')} />
        </FormField>
        <FormField label="Reorder level" error={errors.reorderLevel} hint="Low-stock alert below this">
          <Input type="number" min={0} {...form.register('reorderLevel')} />
        </FormField>
        <FormField label="GST %" error={errors.gstPercent}>
          <Input type="number" min={0} max={28} {...form.register('gstPercent')} />
        </FormField>
        <FormField label="Specifications" className="sm:col-span-2">
          <Textarea rows={2} {...form.register('specs')} />
        </FormField>
      </form>
    </Dialog>
  );
}
