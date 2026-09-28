'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useMarkNotificationRead, useNotifications } from '@/hooks/api/use-misc';
import { cn, formatRelative } from '@/lib/utils';
import type { AppNotification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn('flex w-full gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted', !n.readAt && 'bg-primary-soft/60')}
    >
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary dark:bg-blue-400')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', !n.readAt && 'font-medium')}>{n.title}</span>
        {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
      </span>
      {!n.readAt && <span className="sr-only">Unread</span>}
    </button>
  );
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = data?.meta.unread ?? data?.data.filter((n) => !n.readAt).length ?? 0;

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && (
            <span className="tabular absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={() => markRead.mutate('all')}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {isLoading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
          {!isLoading && data?.data.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {data?.data.map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} />)}
        </div>
        <div className="border-t border-border p-1.5">
          <Link href="/notifications" onClick={() => setOpen(false)} className="block rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-muted dark:text-blue-400">
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
