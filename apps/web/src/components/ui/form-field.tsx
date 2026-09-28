import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FormFieldProps {
  label?: ReactNode;
  /** RHF `fieldState.error` / `formState.errors.x`, or a plain message. */
  error?: { message?: string } | string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /** Pass an id when the control isn't the direct child (e.g. wrapped components). */
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error wrapper. Wires `id`, `aria-invalid` and `aria-describedby` onto the
 * single child control automatically.
 */
export function FormField({ label, error, hint, required, className, htmlFor, children }: FormFieldProps) {
  const autoId = useId();
  const message = typeof error === 'string' ? error : error?.message;
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const id = htmlFor ?? (only?.props.id as string | undefined) ?? autoId;
  const descId = message ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const control = only
    ? cloneElement(only, {
        id,
        'aria-invalid': message ? true : undefined,
        'aria-describedby': descId,
      })
    : children;

  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {control}
      {message ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
