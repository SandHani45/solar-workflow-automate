'use client';

import { ChevronsUpDown, Search } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxOption<T> {
  value: string;
  label: string;
  description?: ReactNode;
  data: T;
}

/**
 * Searchable single-select. `onSearch` lets the parent fetch remotely (inventory item picker,
 * project picker); otherwise options are filtered locally.
 */
export function Combobox<T>({
  options,
  value,
  onSelect,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  onSearch,
  loading,
  id,
  className,
  disabled,
  selectedLabel,
}: {
  options: ComboboxOption<T>[];
  value?: string | null;
  onSelect: (opt: ComboboxOption<T>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  loading?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Label to show when the selected value isn't in the current options page. */
  selectedLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const shown = onSearch ? options : options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const current = options.find((o) => o.value === value);

  const choose = (o: ComboboxOption<T>) => {
    onSelect(o);
    setOpen(false);
    setQ('');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) choose(o);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" id={id} className={cn(inputClass, 'items-center justify-between gap-2 text-left', className)} aria-haspopup="listbox" aria-expanded={open}>
          <span className={cn('truncate', !current && !selectedLabel && 'text-muted-foreground/70')}>{current?.label ?? selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-1">
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              onSearch?.(e.target.value);
            }}
            onKeyDown={onKey}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={cn(inputClass, 'h-8 pl-8')}
          />
        </div>
        <div role="listbox" className="max-h-64 overflow-y-auto">
          {loading && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Loading…</p>}
          {!loading && shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>}
          {!loading &&
            shown.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn('flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm', i === active && 'bg-muted')}
              >
                <span>{o.label}</span>
                {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
