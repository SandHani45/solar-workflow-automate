import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

/**
 * Native date picker (`YYYY-MM-DD` string value) — best UX on phones. Pair with
 * `toDateInputValue()` for defaults; zod `z.coerce.date()` parses the string.
 */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function DateInput({ className, ...props }, ref) {
  return <input ref={ref} type="date" className={cn(inputClass, 'tabular [color-scheme:light] dark:[color-scheme:dark]', className)} {...props} />;
});
