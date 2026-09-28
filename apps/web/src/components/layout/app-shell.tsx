'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { CommandSearch } from './command-search';
import { PLATFORM_NAV, resolveNav, type NavItem, type ResolvedNavItem } from './nav';
import { NotificationsPopover } from './notifications-popover';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

const CUSTOMER_PATHS = ['/portal', '/notifications', '/profile'];

function useCommandShortcut(setOpen: (fn: (o: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Search (Ctrl+K)"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 truncate text-left">Search projects, leads, tickets…</span>
      <kbd className="hidden rounded border border-border bg-card px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
    </button>
  );
}

/**
 * Authenticated shell: permission/feature-filtered sidebar, topbar (⌘K search, notifications,
 * theme, account) and a slide-over nav on phones. Customers get the minimal portal shell;
 * super admins without an org are sent to /platform.
 */
export function AppShell({ children, platform }: { children: ReactNode; /** Super-admin platform console. */ platform?: boolean }) {
  const nav: NavItem[] | undefined = platform ? PLATFORM_NAV : undefined;
  const badge = platform ? 'Platform' : undefined;
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useCommandShortcut(setSearchOpen);

  const isCustomer = session.user.roleKey === 'customer' && !nav;
  const noOrg = !session.org && !nav;
  const customerOutOfBounds = isCustomer && !CUSTOMER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (noOrg && session.user.isSuperAdmin) router.replace('/platform');
    else if (customerOutOfBounds) router.replace('/portal');
  }, [noOrg, customerOutOfBounds, session.user.isSuperAdmin, router]);

  if (isCustomer) return <PortalShell>{customerOutOfBounds ? null : children}</PortalShell>;

  const items: ResolvedNavItem[] = resolveNav(session, nav);
  const orgName = session.org?.name ?? 'SolarFlow Platform';
  const notificationsOn = session.features?.notifications !== false && !!session.org;

  const orgCard = (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="truncate text-xs font-semibold">{orgName}</p>
      <p className="truncate text-[11px] text-muted-foreground capitalize">{session.org ? `${session.org.plan} plan` : 'Super admin'}</p>
    </div>
  );
  const roleLine = (
    <span className="block text-[11px] text-muted-foreground">
      Signed in as <span className="font-medium text-foreground">{session.role?.name ?? (session.user.isSuperAdmin ? 'Super admin' : session.user.roleKey)}</span>
    </span>
  );
  const home = nav ? '/platform' : '/dashboard';

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo href={home} />
          {badge && <Badge tone="gold">{badge}</Badge>}
        </div>
        <div className="px-3 pb-2">{orgCard}</div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-border px-4 py-3">{roleLine}</div>
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="left" size="md" title="SolarFlow" description={roleLine} className="max-w-[300px]">
        <div className="mb-4">{orgCard}</div>
        <SidebarNav items={items} onNavigate={() => setMenuOpen(false)} />
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Logo compact href={home} className="lg:hidden" />
          <div className="flex flex-1 justify-center sm:justify-start">
            <div className="hidden w-full sm:block">
              <SearchTrigger onClick={() => setSearchOpen(true)} />
            </div>
          </div>
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search />
          </Button>
          {notificationsOn && <NotificationsPopover />}
          <ThemeToggle />
          <UserMenu />
        </header>
        <main id="main" className={cn('mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8')}>
          {children}
        </main>
      </div>
      {!nav && <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}

/** Minimal shell for customers: logo, portal link, notifications, account. */
export function PortalShell({ children }: { children: ReactNode }) {
  const session = useSession();
  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary-soft/60 to-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Logo href="/portal" />
          <span className="ml-2 hidden truncate text-sm text-muted-foreground sm:inline">{session.org?.name}</span>
          <div className="flex-1" />
          {session.features?.notifications && <NotificationsPopover />}
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
