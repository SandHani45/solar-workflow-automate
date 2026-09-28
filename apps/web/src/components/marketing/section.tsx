import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Section({ id, eyebrow, title, description, children, className }: { id?: string; eyebrow?: string; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24', className)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          {eyebrow && <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{eyebrow}</p>}
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {description && <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
            {f.q}
            <span aria-hidden className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
