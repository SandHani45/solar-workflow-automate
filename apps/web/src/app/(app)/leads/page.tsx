'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Columns3, List, MoreVertical, Phone, Plus } from 'lucide-react';
import { useState } from 'react';
import { humanize, LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from '@solar/shared';
import { useLeadBoard, useLeads, useMoveLead } from '@/hooks/api/use-leads';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { Lead } from '@/lib/types';
import { formatDate, formatINR, formatRelative } from '@/lib/utils';
import { statusTone } from '@/lib/status';
import { Require } from '@/components/auth/require';
import { LeadDialog } from '@/components/leads/lead-dialog';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KanbanBoard } from '@/components/ui/kanban-board';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';

export default function LeadsPage() {
  return (
    <Require permission="leads:read" feature="leads_crm">
      <LeadsView />
    </Require>
  );
}

function LeadsView() {
  const router = useRouter();
  const canWrite = useCan({ permission: 'leads:write' });
  const [params, setParams] = useQueryParams();
  const view = params.get('view') === 'board' ? 'board' : 'list';
  const filters = { q: params.get('q') ?? '', status: params.get('status') ?? '', source: params.get('source') ?? '', page: Number(params.get('page') ?? 1) };
  const list = useLeads({ ...filters, limit: 20, sort: '-createdAt' });
  const board = useLeadBoard(view === 'board');
  const move = useMoveLead();
  const [creating, setCreating] = useState(false);

  const columns: Column<Lead>[] = [
    {
      id: 'name',
      header: 'Lead',
      sortValue: (l) => l.name,
      cell: (l) => (
        <div>
          <p className="font-medium">{l.name}</p>
          <p className="text-xs text-muted-foreground">
            {l.code} · {l.phone}
          </p>
        </div>
      ),
    },
    { id: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
    { id: 'source', header: 'Source', cell: (l) => humanize(l.source), hideOnMobile: true },
    { id: 'kw', header: 'Size', cell: (l) => (l.requiredKw ? `${l.requiredKw} kW` : '—'), sortValue: (l) => l.requiredKw ?? 0, hideOnMobile: true },
    { id: 'bill', header: 'Monthly bill', align: 'right', cell: (l) => (l.monthlyBill ? formatINR(l.monthlyBill) : '—'), hideOnMobile: true },
    { id: 'followUpAt', header: 'Follow-up', cell: (l) => (l.followUpAt ? formatDate(l.followUpAt, 'd MMM') : '—'), sortValue: (l) => l.followUpAt ?? '' },
    { id: 'assigned', header: 'Owner', cell: (l) => (l.assignedTo ? <span className="inline-flex items-center gap-1.5"><Avatar name={l.assignedTo.name} size="xs" />{l.assignedTo.name}</span> : '—'), hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry, follow-up and site visit until the order is won."
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={(v) => setParams({ view: v === 'list' ? null : v })}
              options={[
                { value: 'list', label: 'List', icon: <List /> },
                { value: 'board', label: 'Pipeline', icon: <Columns3 /> },
              ]}
            />
            {canWrite && (
              <Button onClick={() => setCreating(true)}>
                <Plus /> New lead
              </Button>
            )}
          </>
        }
      />

      {view === 'list' ? (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search name or phone…" />
            <Select aria-label="Status" className="sm:w-48" placeholder="All statuses" value={filters.status} onChange={(e) => setParams({ status: e.target.value, page: null })} options={LEAD_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
            <Select aria-label="Source" className="sm:w-44" placeholder="All sources" value={filters.source} onChange={(e) => setParams({ source: e.target.value, page: null })} options={LEAD_SOURCES.map((s) => ({ value: s, label: humanize(s) }))} />
          </div>
          <DataTable
            caption="Leads"
            columns={columns}
            data={list.data?.data}
            rowKey={(l) => l.id}
            loading={list.isLoading}
            error={list.error}
            meta={list.data?.meta}
            onPageChange={(p) => setParams({ page: String(p) })}
            onRowClick={(l) => router.push(`/leads/${l.id}`)}
            empty={<EmptyState icon={ClipboardList} title="No leads found" description="Add your first enquiry to start the pipeline." action={canWrite && <Button onClick={() => setCreating(true)}>New lead</Button>} />}
          />
        </>
      ) : board.error ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : (
        <KanbanBoard
          loading={board.isLoading}
          columns={LEAD_STATUSES.map((s) => ({ key: s, title: humanize(s), tone: statusTone(s), items: board.data?.[s] ?? [] }))}
          itemKey={(l) => l.id}
          onMove={canWrite ? (lead, _from, to) => move.mutate({ lead, to: to as LeadStatus }) : undefined}
          renderCard={(l) => <LeadCard lead={l} canMove={canWrite} onMove={(to) => move.mutate({ lead: l, to })} />}
          emptyLabel="Drop leads here"
        />
      )}
      <LeadDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function LeadCard({ lead, canMove, onMove }: { lead: Lead; canMove: boolean; onMove: (to: LeadStatus) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 hover:underline">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {lead.code} · {humanize(lead.source)}
          </p>
        </Link>
        {canMove && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label={`Move ${lead.name}`}>
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                  {humanize(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {lead.requiredKw ? <span>{lead.requiredKw} kW</span> : null}
        {lead.monthlyBill ? <span className="tabular">{formatINR(lead.monthlyBill)}/mo</span> : null}
        <a href={`tel:${lead.phone}`} className="ml-auto inline-flex items-center gap-1 text-primary dark:text-blue-400" aria-label={`Call ${lead.name}`}>
          <Phone className="size-3" /> Call
        </a>
      </div>
      {lead.followUpAt && <p className="mt-1.5 text-[11px] text-muted-foreground">Follow-up {formatRelative(lead.followUpAt)}</p>}
    </div>
  );
}
