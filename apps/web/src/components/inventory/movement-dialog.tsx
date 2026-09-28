'use client';

import { useState } from 'react';
import { humanize, stockMovementSchema, type StockMovementType } from '@solar/shared';
import { useCreateMovement } from '@/hooks/api/use-inventory';
import { useCan } from '@/hooks/use-session';
import type { InventoryItem } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/tabs';

const COPY: Record<StockMovementType, { title: string; hint: string }> = {
  in: { title: 'Stock in', hint: 'Purchase received. Updates weighted-average cost.' },
  out: { title: 'Stock out', hint: 'Issue to a project or site. Cannot exceed stock on hand.' },
  adjust: { title: 'Adjust', hint: 'Record a stock correction after damage or a physical audit; explain it in the note.' },
  return: { title: 'Return', hint: 'Unused material returned from a site.' },
};

export function MovementDialog({ item, initialType = 'in', onOpenChange }: { item: InventoryItem | null; initialType?: StockMovementType; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange} title={item ? `Stock movement · ${item.name}` : 'Stock movement'} description={item ? `${formatNumber(item.quantity)} ${item.unit} on hand · ${formatNumber(item.available)} available` : undefined}>
      {item && <MovementForm key={`${item.id}-${initialType}`} item={item} initialType={initialType} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function MovementForm({ item, initialType, onDone }: { item: InventoryItem; initialType: StockMovementType; onDone: () => void }) {
  const canAdjust = useCan({ permission: 'inventory:adjust' });
  const canWrite = useCan({ permission: 'inventory:write' });
  const create = useCreateMovement();
  const [type, setType] = useState<StockMovementType>(initialType);
  const [v, setV] = useState({ quantity: '', unitCost: String(item.costPrice || ''), projectId: '', reference: '', note: '' });
  const [error, setError] = useState<string | null>(null);

  const allowed = (['in', 'out', 'adjust', 'return'] as const).filter((t) => (t === 'in' || t === 'return' ? canWrite : canAdjust));

  const submit = () => {
    const parsed = stockMovementSchema.safeParse({
      itemId: item.id,
      type,
      quantity: v.quantity,
      unitCost: type === 'in' && v.unitCost ? v.unitCost : undefined,
      projectId: v.projectId || undefined,
      reference: v.reference || undefined,
      note: v.note || undefined,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    if (type === 'out' && parsed.data.quantity > item.quantity) return setError(`Only ${item.quantity} ${item.unit} in stock`);
    setError(null);
    create.mutate(parsed.data, { onSuccess: onDone });
  };

  return (
    <div className="space-y-4">
      <Segmented label="Movement type" value={type} onChange={setType} options={allowed.map((t) => ({ value: t, label: COPY[t].title }))} />
      <p className="text-xs text-muted-foreground">{COPY[type].hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={`Quantity (${item.unit})`} required>
          <Input type="number" min={0} step="any" inputMode="decimal" autoFocus value={v.quantity} onChange={(e) => setV((s) => ({ ...s, quantity: e.target.value }))} />
        </FormField>
        {type === 'in' && (
          <FormField label="Unit cost">
            <CurrencyInput value={v.unitCost} onChange={(e) => setV((s) => ({ ...s, unitCost: e.target.value }))} />
          </FormField>
        )}
        {(type === 'out' || type === 'return') && (
          <FormField label="Project" className="sm:col-span-2" htmlFor="mv-project">
            <ProjectPicker id="mv-project" value={v.projectId} onChange={(p) => setV((s) => ({ ...s, projectId: p.id }))} />
          </FormField>
        )}
        <FormField label="Reference" hint="Invoice / challan no.">
          <Input value={v.reference} onChange={(e) => setV((s) => ({ ...s, reference: e.target.value }))} />
        </FormField>
        <FormField label="Note">
          <Input value={v.note} onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))} />
        </FormField>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={submit} loading={create.isPending}>
          Save {humanize(type).toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
