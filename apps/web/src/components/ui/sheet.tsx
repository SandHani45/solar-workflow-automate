'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Rendered above the title row (e.g. badges). */
  eyebrow?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

const WIDTHS = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' };

/** Side drawer (full-screen on phones). Used for stage completion, record details, mobile nav. */
export function Sheet({ open, onOpenChange, title, description, eyebrow, children, footer, side = 'right', size = 'lg', className }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 z-50 flex h-dvh w-full flex-col border-border bg-card shadow-2xl outline-none',
            side === 'right' ? 'right-0 border-l data-[state=open]:animate-slide-in-right' : 'left-0 border-r data-[state=open]:animate-in',
            WIDTHS[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{eyebrow}</div>}
              <DialogPrimitive.Title className="text-base leading-snug font-semibold sm:text-lg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Details'}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 scroll-pb-24 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
