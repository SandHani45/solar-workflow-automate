'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActive, type ResolvedNavItem } from './nav';

const SECTION_LABELS: Record<NonNullable<ResolvedNavItem['section']>, string> = {
  work: 'Workspace',
  business: 'Business',
  admin: 'Administration',
};

export function SidebarNav({ items, onNavigate }: { items: ResolvedNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = Array.from(new Set(items.map((i) => i.section)));

  return (
    <nav aria-label="Main" className="space-y-5">
      {sections.map((section) => (
        <div key={section ?? 'main'}>
          {section && <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">{SECTION_LABELS[section]}</p>}
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.section === section)
              .map((item) => {
                const active = isActive(pathname, item.basePath, item.basePath === '/platform');
                return (
                  <li key={item.basePath}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active ? 'bg-primary-soft text-primary dark:text-blue-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <item.icon className={cn('size-4.5 shrink-0', active ? 'text-primary dark:text-blue-400' : 'text-muted-foreground group-hover:text-foreground')} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
