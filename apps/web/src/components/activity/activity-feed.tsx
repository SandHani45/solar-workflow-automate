import Link from 'next/link';
import { Activity } from 'lucide-react';
import type { AuditEntry } from '@/lib/types';
import { formatDateTime, formatRelative, humanize } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Timeline } from '@/components/ui/stepper';

const ENTITY_HREF: Record<string, string> = { project: '/projects', lead: '/leads', ticket: '/service', quotation: '/quotations' };

/** Audit entries as a timeline (project Timeline tab, dashboard, reports). */
export function ActivityFeed({ items, linkEntities }: { items: AuditEntry[]; linkEntities?: boolean }) {
  if (items.length === 0) return <EmptyState compact icon={Activity} title="No activity yet" />;
  return (
    <Timeline
      items={items.map((a) => {
        const base = ENTITY_HREF[a.entity];
        return {
          id: a.id,
          icon: a.user ? <Avatar name={a.user.name} size="xs" className="ring-0" /> : undefined,
          title: (
            <span>
              <span className="font-medium">{a.user?.name ?? 'System'}</span> <span className="text-muted-foreground">{a.summary || humanize(a.action)}</span>
              {linkEntities && base && (
                <>
                  {' '}
                  <Link href={`${base}/${a.entityId}`} className="text-primary hover:underline dark:text-blue-400">
                    view
                  </Link>
                </>
              )}
            </span>
          ),
          meta: <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{formatRelative(a.createdAt)}</time>,
        };
      })}
    />
  );
}
