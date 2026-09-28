'use client';

import { useState } from 'react';
import { useProjects } from '@/hooks/api/use-projects';
import { useDebounce } from '@/hooks/use-debounce';
import type { Project } from '@/lib/types';
import { Combobox } from '@/components/ui/combobox';

/** Searchable project selector (code, customer name or phone). */
export function ProjectPicker({ value, onChange, id, disabled }: { value?: string; onChange: (project: Project) => void; id?: string; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 250);
  const { data, isFetching } = useProjects({ q: debounced, limit: 20 });
  const [selectedLabel, setSelectedLabel] = useState<string>();
  const options = (data?.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.customer.name}`, description: p.customer.phone, data: p }));
  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      selectedLabel={selectedLabel}
      onSearch={setQ}
      loading={isFetching && options.length === 0}
      placeholder="Select a project…"
      searchPlaceholder="Search code, customer, phone…"
      disabled={disabled}
      onSelect={(o) => {
        setSelectedLabel(o.label);
        onChange(o.data);
      }}
    />
  );
}
