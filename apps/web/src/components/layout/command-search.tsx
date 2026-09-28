'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardList, CornerDownLeft, FolderKanban, Loader2, Search, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { humanize } from '@solar/shared';
import { useSearch } from '@/hooks/api/use-misc';
import { useDebounce } from '@/hooks/use-debounce';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { resolveNav } from './nav';

interface ResultRow {
  id: string;
  group: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  href: string;
}

/** Global ⌘K / Ctrl+K search over projects, leads and tickets plus quick page navigation. */
export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <DialogPrimitive.Content className="fixed top-[10vh] left-1/2 z-50 w-[min(94vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl outline-none data-[state=open]:animate-zoom-in">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search projects, leads, tickets and pages</DialogPrimitive.Description>
          {open && <SearchBody onDone={() => onOpenChange(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const session = useSession();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q.trim(), 250);
  const { data, isFetching } = useSearch(debounced);

  const rows = useMemo<ResultRow[]>(() => {
    const out: ResultRow[] = [];
    const needle = q.trim().toLowerCase();
    for (const item of resolveNav(session)) {
      if (!needle || item.label.toLowerCase().includes(needle)) {
        out.push({ id: `nav-${item.href}`, group: 'Go to', icon: <item.icon />, title: item.label, href: item.href });
      }
    }
    if (debounced.length >= 2 && data) {
      for (const p of data.projects) {
        out.push({ id: `p-${p.id}`, group: 'Projects', icon: <FolderKanban />, title: `${p.code} · ${p.customer?.name ?? p.customerName ?? ''}`, subtitle: p.currentPhase ? humanize(p.currentPhase) : undefined, href: `/projects/${p.id}` });
      }
      for (const l of data.leads) {
        out.push({ id: `l-${l.id}`, group: 'Leads', icon: <ClipboardList />, title: `${l.code} · ${l.name}`, subtitle: [l.phone, l.status && humanize(l.status)].filter(Boolean).join(' · '), href: `/leads/${l.id}` });
      }
      for (const t of data.tickets) {
        out.push({ id: `t-${t.id}`, group: 'Tickets', icon: <Wrench />, title: `${t.code} · ${t.subject}`, subtitle: t.status && humanize(t.status), href: `/service/${t.id}` });
      }
    }
    return needle ? out : out.slice(0, 8);
  }, [q, debounced, data, session]);

  useEffect(() => {
    document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (row: ResultRow | undefined) => {
    if (!row) return;
    onDone();
    router.push(row.href);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(rows[active]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-4">
        {isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-4 text-muted-foreground" aria-hidden />}
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search projects, customers, phone numbers, tickets…"
          className="h-13 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          role="combobox"
          aria-expanded
          aria-controls="cmd-results"
          aria-activedescendant={rows[active] ? `cmd-${active}` : undefined}
          aria-label="Search"
        />
        <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:inline">ESC</kbd>
      </div>
      <div id="cmd-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
        {rows.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">{debounced.length >= 2 && !isFetching ? `No results for “${debounced}”` : 'Type at least 2 characters to search records'}</p>
        )}
        {rows.map((r, i) => {
          const header = rows[i - 1]?.group !== r.group ? r.group : null;
          return (
            <div key={r.id}>
              {header && <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{header}</p>}
              <button
                id={`cmd-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => go(r)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm [&_svg]:size-4 [&_svg]:text-muted-foreground', i === active && 'bg-muted')}
              >
                {r.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.title}</span>
                  {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                </span>
                {i === active ? <CornerDownLeft className="size-3.5" aria-hidden /> : <ArrowRight className="size-3.5 opacity-0" aria-hidden />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
