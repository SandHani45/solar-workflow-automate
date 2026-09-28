'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowRightLeft, FileSpreadsheet, Mail, MapPin, MessageCircle, Pencil, Phone, PhoneCall, StickyNote, Trash2, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { humanize } from '@solar/shared';
import { useAddLeadActivity, useConvertLead, useDeleteLead, useLead, useUpdateLead } from '@/hooks/api/use-leads';
import { useCan } from '@/hooks/use-session';
import type { LeadActivityType } from '@/lib/types';
import { formatAddress, formatDate, formatDateTime, formatINR, formatRelative, toDateInputValue } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Timeline } from '@/components/ui/stepper';
import { Segmented } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LeadDialog } from '@/components/leads/lead-dialog';

const ACTIVITY_ICONS: Record<LeadActivityType, React.ReactNode> = {
  call: <PhoneCall />,
  whatsapp: <MessageCircle />,
  visit: <Users />,
  email: <Mail />,
  note: <StickyNote />,
};

export default function LeadDetailPage() {
  return (
    <Require permission="leads:read" feature="leads_crm">
      <LeadDetail />
    </Require>
  );
}

function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, isLoading, error, refetch } = useLead(id);
  const canWrite = useCan({ permission: 'leads:write' });
  const canDelete = useCan({ permission: 'leads:delete' });
  const canConvert = useCan({ permission: 'projects:write' });
  const canQuote = useCan({ permission: 'quotations:write', feature: 'quotations' });
  const update = useUpdateLead(id);
  const remove = useDeleteLead();
  const addActivity = useAddLeadActivity(id);
  const convert = useConvertLead(id);

  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [losing, setLosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activity, setActivity] = useState<{ type: LeadActivityType; note: string; followUpAt: string }>({ type: 'call', note: '', followUpAt: '' });
  const [conv, setConv] = useState({ systemSizeKw: '', contractValue: '' });

  if (isLoading) return <PageSkeleton cards={0} />;
  if (error || !lead) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const converted = !!lead.projectId;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', href: '/leads' }, { label: lead.code }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {lead.name} <StatusBadge status={lead.status} size="md" />
          </span>
        }
        description={`${lead.code} · ${humanize(lead.customerType)} · via ${humanize(lead.source)} · created ${formatRelative(lead.createdAt)}`}
        actions={
          <>
            <ButtonLink href={`tel:${lead.phone}`} variant="outline">
              <Phone /> Call
            </ButtonLink>
            {canWrite && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
            {canQuote && !converted && (
              <ButtonLink href={`/quotations/new?leadId=${lead.id}`} variant="outline">
                <FileSpreadsheet /> Quotation
              </ButtonLink>
            )}
            {converted ? (
              <ButtonLink href={`/projects/${lead.projectId}`}>
                <ArrowRightLeft /> Open project
              </ButtonLink>
            ) : (
              canConvert &&
              lead.status !== 'lost' && (
                <Button
                  onClick={() => {
                    setConv({ systemSizeKw: String(lead.requiredKw ?? ''), contractValue: '' });
                    setConverting(true);
                  }}
                >
                  <ArrowRightLeft /> Convert to project
                </Button>
              )
            )}
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Detail label="Phone">{lead.phone}</Detail>
                <Detail label="Email">{lead.email || '—'}</Detail>
                <Detail label="Monthly bill">{lead.monthlyBill ? formatINR(lead.monthlyBill) : '—'}</Detail>
                <Detail label="Required size">{lead.requiredKw ? `${lead.requiredKw} kW` : '—'}</Detail>
                <Detail label="Owner">{lead.assignedTo?.name ?? 'Unassigned'}</Detail>
                <Detail label="Next follow-up">{formatDate(lead.followUpAt)}</Detail>
                <Detail label="Address" wide>
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {formatAddress(lead.address) || '—'}
                  </span>
                </Detail>
                {lead.notes && <Detail label="Notes" wide>{lead.notes}</Detail>}
                {lead.lostReason && <Detail label="Lost reason" wide>{lead.lostReason}</Detail>}
              </dl>
            </CardContent>
          </Card>
          {canWrite && !converted && (
            <div className="flex flex-wrap gap-2">
              {lead.status !== 'lost' && (
                <Button variant="outline" onClick={() => setLosing(true)}>
                  <XCircle /> Mark as lost
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" className="text-rose-600" onClick={() => setDeleting(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          )}
        </div>

        <Card>
          <CardHeader title="Activity" description="Calls, WhatsApp messages, visits and notes" />
          <CardContent className="space-y-6">
            {canWrite && (
              <form
                className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!activity.note.trim()) return;
                  addActivity.mutate(
                    { type: activity.type, note: activity.note.trim(), followUpAt: activity.followUpAt || undefined },
                    { onSuccess: () => setActivity({ type: activity.type, note: '', followUpAt: '' }) },
                  );
                }}
              >
                <Segmented
                  label="Activity type"
                  value={activity.type}
                  onChange={(type) => setActivity((a) => ({ ...a, type }))}
                  options={(['call', 'whatsapp', 'visit', 'email', 'note'] as const).map((t) => ({ value: t, label: humanize(t) }))}
                  className="flex-wrap"
                />
                <Textarea value={activity.note} onChange={(e) => setActivity((a) => ({ ...a, note: e.target.value }))} placeholder="What happened? e.g. Discussed 5kW on-grid, wants subsidy details" rows={2} aria-label="Activity note" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <FormField label="Next follow-up (optional)" className="sm:w-56">
                    <DateInput value={activity.followUpAt} min={toDateInputValue(new Date())} onChange={(e) => setActivity((a) => ({ ...a, followUpAt: e.target.value }))} />
                  </FormField>
                  <Button type="submit" loading={addActivity.isPending} disabled={!activity.note.trim()} className="sm:ml-auto">
                    Log activity
                  </Button>
                </div>
              </form>
            )}
            {(lead.activities?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              <Timeline
                items={[...(lead.activities ?? [])].reverse().map((a) => ({
                  id: a.id,
                  icon: ACTIVITY_ICONS[a.type],
                  title: (
                    <span>
                      <span className="font-medium">{humanize(a.type)}</span> <span className="text-muted-foreground">by {a.by?.name}</span>
                    </span>
                  ),
                  body: a.note,
                  meta: formatDateTime(a.at),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <LeadDialog key={lead.updatedAt} open={editing} onOpenChange={setEditing} lead={lead} />

      <Dialog
        open={converting}
        onOpenChange={setConverting}
        title="Convert to project"
        description="Creates a project with the current workflow and marks this lead as won."
        footer={
          <>
            <Button variant="outline" onClick={() => setConverting(false)}>
              Cancel
            </Button>
            <Button
              loading={convert.isPending}
              disabled={!Number(conv.systemSizeKw)}
              onClick={() =>
                convert.mutate(
                  { systemSizeKw: Number(conv.systemSizeKw), contractValue: conv.contractValue ? Number(conv.contractValue) : undefined },
                  { onSuccess: (p) => router.push(`/projects/${p.id}`) },
                )
              }
            >
              Create project
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="System size (kW)" required>
            <Input type="number" step="0.01" inputMode="decimal" value={conv.systemSizeKw} onChange={(e) => setConv((c) => ({ ...c, systemSizeKw: e.target.value }))} />
          </FormField>
          <FormField label="Contract value" hint="Optional — set at final quotation">
            <CurrencyInput value={conv.contractValue} onChange={(e) => setConv((c) => ({ ...c, contractValue: e.target.value }))} />
          </FormField>
        </div>
      </Dialog>

      <ConfirmDialog
        open={losing}
        onOpenChange={setLosing}
        title="Mark lead as lost"
        reason={{ label: 'Why was it lost?', required: true, placeholder: 'Price, went with competitor, roof not suitable…' }}
        confirmLabel="Mark lost"
        destructive
        loading={update.isPending}
        onConfirm={(lostReason) => update.mutate({ status: 'lost', lostReason }, { onSuccess: () => setLosing(false) })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${lead.code}?`}
        destructive
        confirmLabel="Delete lead"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(lead.id, { onSuccess: () => router.push('/leads') })}
      />
    </>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium whitespace-pre-line [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
