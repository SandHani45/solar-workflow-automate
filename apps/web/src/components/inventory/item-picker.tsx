'use client';

import { useState } from 'react';
import { useItems } from '@/hooks/api/use-inventory';
import { useDebounce } from '@/hooks/use-debounce';
import type { InventoryItem } from '@/lib/types';
import { formatINR, formatNumber } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';

/** Search warehouse items by name/SKU; shows available stock and cost. */
export function ItemPicker({ onPick, placeholder = 'Add item from inventory…', className }: { onPick: (item: InventoryItem) => void; placeholder?: string; className?: string }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 250);
  const { data, isFetching } = useItems({ q: debounced, limit: 20 });
  const options = (data?.data ?? []).map((i) => ({
    value: i.id,
    label: `${i.name} (${i.sku})`,
    description: `${formatNumber(i.available)} ${i.unit} available · ${formatINR(i.costPrice)}/${i.unit}`,
    data: i,
  }));
  return <Combobox options={options} onSearch={setQ} loading={isFetching && options.length === 0} placeholder={placeholder} searchPlaceholder="Search item or SKU…" onSelect={(o) => onPick(o.data)} className={className} />;
}
