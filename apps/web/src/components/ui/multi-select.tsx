'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

/** Chip-style multi select with filter (roles, dependsOn, required documents). */
export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  id,
  className,
  emptyLabel = 'No options',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" id={id} className={cn(inputClass, 'h-auto min-h-9 flex-wrap items-center gap-1 py-1 pr-8 text-left', className)} aria-haspopup="listbox">
          {value.length === 0 && <span className="text-muted-foreground/70">{placeholder}</span>}
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
              {labelOf.get(v) ?? v}
              {!disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf.get(v) ?? v}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                >
                  <X className="size-3" />
                </span>
              )}
            </span>
          ))}
          <ChevronDown className="absolute right-2.5 size-4 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-1">
        {options.length > 6 && (
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className={cn(inputClass, 'mb-1 h-8')} aria-label="Filter options" />
        )}
        <div role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyLabel}</p>}
          {filtered.map((o) => {
            const selected = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className={cn('flex size-4 items-center justify-center rounded border', selected ? 'border-primary bg-primary text-white' : 'border-input')}>
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">{o.label}</span>
                {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
