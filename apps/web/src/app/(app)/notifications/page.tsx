'use client';

import { useRouter } from 'next/navigation';
import { BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useMarkNotificationRead, useNotifications } from '@/hooks/api/use-misc';
import type { AppNotification } from '@/lib/types';
import { Require } from '@/components/auth/require';
import { NotificationItem } from '@/components/layout/notifications-popover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/tabs';

export default function NotificationsPage() {
  return (
    <Require feature="notifications">
      <Notifications />
    </Require>
  );
}

function Notifications() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useNotifications({ page, limit: 30, unread: filter === 'unread' ? true : undefined });
  const mark = useMarkNotificationRead();
  const open = (n: AppNotification) => {
    if (!n.readAt) mark.mutate(n.id);
    if (n.link) router.push(n.link);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          <>
            <Segmented label="Filter" value={filter} onChange={(f) => { setFilter(f); setPage(1); }} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
            <Button variant="outline" size="sm" onClick={() => mark.mutate('all')} disabled={!data?.meta.unread}>
              <CheckCheck /> Mark all read
            </Button>
          </>
        }
      />
      <Card className="p-2">
        {isLoading && <Skeleton className="h-48" />}
        {error != null && <ErrorState error={error} />}
        {data?.data.length === 0 && <EmptyState icon={BellOff} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Assignments, due dates and stage changes show up here." />}
        {data?.data.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} />)}
        {data && data.meta.pages > 1 && (
          <div className="px-2">
            <Pagination meta={data.meta} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
