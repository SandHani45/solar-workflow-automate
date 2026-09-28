import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

/**
 * Rupee amount input. Uses a numeric keypad on phones; value stays a plain number string so zod's
 * `z.coerce.number()` handles it.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function CurrencyInput({ className, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
        ₹
      </span>
      <input ref={ref} type="number" inputMode="decimal" min={0} step="0.01" className={cn(inputClass, 'tabular pl-7')} {...props} />
    </div>
  );
});
