import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputClass = cn(
  'flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-colors',
  'placeholder:text-muted-foreground/70',
  'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icon or text rendered inside the left edge. */
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, leading, trailing, type = 'text', ...props }, ref) {
  if (!leading && !trailing) return <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4">{leading}</span>}
      <input ref={ref} type={type} className={cn(inputClass, leading && 'pl-9', trailing && 'pr-9')} {...props} />
      {trailing && <span className="absolute right-2 flex items-center text-muted-foreground [&_svg]:size-4">{trailing}</span>}
    </div>
  );
});
