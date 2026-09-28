'use client';

import Link from 'next/link';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { humanize, TICKET_PRIORITIES, TICKET_STATUSES, type TicketStatus } from '@solar/shared';
import { useTicket, useTicketComment, useUpdateTicket } from '@/hooks/api/use-service';
import { useUserOptions } from '@/hooks/api/use-team';
import { useCan } from '@/hooks/use-session';
import { roleShort } from '@/lib/roles';
import { formatDateTime } from '@/lib/utils';
import { CommentThread } from '@/components/projects/comments-tab';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Stepper } from '@/components/ui/stepper';
import { Textarea } from '@/components/ui/textarea';
import { SlaIndicator } from './sla-indicator';

const FLOW: TicketStatus[] = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

/** Ticket view shared by staff (/service/[id]) and customers (portal). Customers only close or reopen. */
export function TicketDetail({ id, customerMode }: { id: string; customerMode?: boolean }) {
  const { data: t, isLoading, error, refetch } = useTicket(id);
  const update = useUpdateTicket(id);
  const comment = useTicketComment(id);
  const canWrite = useCan({ permission: 'tickets:write' }) && !customerMode;
  const canAssign = useCan({ permission: 'tickets:assign' }) && !customerMode;
  const { data: people } = useUserOptions(undefined, canAssign);
  const [resolution, setResolution] = useState('');

  if (isLoading) return <PageSkeleton cards={0} />;
  if (error || !t) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const current = t.status === 'on_hold' ? 'in_progress' : t.status;
  const closed = t.status === 'closed';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={t.status} size="md" />
              <StatusBadge status={t.priority} label={`${humanize(t.priority)} priority`} size="md" />
              <SlaIndicator ticket={t} />
            </div>
            <Stepper steps={FLOW.map((s) => ({ key: s, label: humanize(s) }))} current={current} />
            <div>
              <p className="text-xs text-muted-foreground">
                {humanize(t.category)} · raised by {t.raisedBy?.name} on {formatDateTime(t.createdAt)}
              </p>
              <p className="mt-2 text-sm whitespace-pre-line">{t.description}</p>
            </div>
            {t.resolution && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">Resolution</p>
                <p className="mt-1 whitespace-pre-line">{t.resolution}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Conversation" />
          <CardContent>
            <CommentThread
              comments={t.comments}
              posting={comment.isPending}
              placeholder={customerMode ? 'Add details or reply to the service team…' : 'Reply or add an internal update…'}
              onPost={(b, done) => comment.mutate(b, { onSuccess: done })}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Details" />
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="text-right font-medium">
                  {customerMode ? t.project?.customerName : <Link href={`/projects/${t.projectId}?tab=tickets`} className="text-primary hover:underline dark:text-blue-400">{t.project?.customerName ?? 'Project'}</Link>}
                  <span className="block text-xs font-normal text-muted-foreground">{t.project?.code}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Assignee</dt>
                <dd className="font-medium">{t.assignee?.name ?? 'Unassigned'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Due</dt>
                <dd className="font-medium">{formatDateTime(t.dueAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {(canWrite || canAssign) && !closed && (
          <Card>
            <CardHeader title="Update" />
            <CardContent className="space-y-4">
              {canAssign && (
                <FormField label="Assign to">
                  <Select
                    value={t.assignee?.id ?? ''}
                    placeholder="Unassigned"
                    onChange={(e) => update.mutate({ assigneeId: e.target.value || null, ...(e.target.value && t.status === 'open' ? { status: 'assigned' as const } : {}) })}
                    options={(people ?? []).filter((u) => u.roleKey !== 'customer').map((u) => ({ value: u.id, label: `${u.name} · ${roleShort(u.roleKey)}` }))}
                  />
                </FormField>
              )}
              {canWrite && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Status">
                      <Select value={t.status} onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })} options={TICKET_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
                    </FormField>
                    <FormField label="Priority">
                      <Select value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value as (typeof TICKET_PRIORITIES)[number] })} options={TICKET_PRIORITIES.map((s) => ({ value: s, label: humanize(s) }))} />
                    </FormField>
                  </div>
                  {t.status !== 'resolved' && (
                    <div className="space-y-2">
                      <FormField label="Resolution">
                        <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="What was done to fix it?" />
                      </FormField>
                      <Button className="w-full" disabled={!resolution.trim()} loading={update.isPending} onClick={() => update.mutate({ status: 'resolved', resolution: resolution.trim() })}>
                        <CheckCircle2 /> Mark resolved
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {customerMode && (t.status === 'resolved' || closed) && (
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm">{closed ? 'Issue came back?' : 'Is the issue fixed?'}</p>
              <div className="flex gap-2">
                {!closed && (
                  <Button onClick={() => update.mutate({ status: 'closed' })} loading={update.isPending}>
                    <CheckCircle2 /> Yes, close ticket
                  </Button>
                )}
                <Button variant="outline" onClick={() => update.mutate({ status: 'open' })} disabled={update.isPending}>
                  <RotateCcw /> Reopen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
