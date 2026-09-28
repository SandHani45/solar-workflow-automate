import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Adds an empty first option (e.g. "All statuses"). */
  placeholder?: string;
}

/**
 * Native select, styled. Native keeps it accessible and gives phones their own picker UI,
 * which matters for site engineers.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, placeholder, className, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(inputClass, 'appearance-none pr-8')} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
});

/** Build options from a readonly enum tuple, labelled with `humanize` or a label map. */
export function enumOptions<T extends string>(values: readonly T[], label: (v: T) => string): SelectOption[] {
  return values.map((v) => ({ value: v, label: label(v) }));
}
