'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { resolveNav } from './nav';

/** Link-based sub navigation for a section (Inventory, Finance, Service, Team, Settings). */
export function SectionTabs({ section }: { section: string }) {
  const pathname = usePathname();
  const session = useSession();
  const item = resolveNav(session).find((i) => i.basePath === section);
  const children = item?.children ?? [];
  if (children.length < 2) return null;

  // Longest matching href wins so /finance doesn't stay active on /finance/payments.
  const activeHref = children
    .map((c) => c.href)
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label={`${item?.label} sections`} className="relative scrollbar-thin -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {children.map((c) => {
        const active = c.href === activeHref;
        return (
          <Link
            key={c.href}
            href={c.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'border-primary text-foreground dark:border-blue-400' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
