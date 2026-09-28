'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

/**
 * Debounced search box. Local state keeps typing instant; `onChange` fires after `delay` ms idle.
 * The parent value is only read on mount (and when cleared externally via `key`).
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  delay = 300,
  className,
  label = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  label?: string;
}) {
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  const lastEmitted = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (text === lastEmitted.current) return;
    const t = setTimeout(() => {
      lastEmitted.current = text;
      onChangeRef.current(text);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            lastEmitted.current = '';
            onChangeRef.current('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
