'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { humanize, TICKET_PRIORITIES, TICKET_STATUSES } from '@solar/shared';
import { useTickets } from '@/hooks/api/use-service';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan, useSession } from '@/hooks/use-session';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { TicketDialog } from '@/components/service/ticket-dialog';
import { TicketTable } from '@/components/service/ticket-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';

export default function ServicePage() {
  return (
    <Require permission="tickets:read" feature="service_tickets">
      <Tickets />
    </Require>
  );
}

function Tickets() {
  const session = useSession();
  const canWrite = useCan({ permission: 'tickets:write' });
  const [params, setParams] = useQueryParams();
  const filters = {
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    assigneeId: params.get('mine') === '1' ? session.user.id : '',
    page: Number(params.get('page') ?? 1),
  };
  const { data, isLoading, error } = useTickets({ ...filters, limit: 20, sort: 'dueAt' });
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Service"
        description="Customer tickets with SLA tracking, and AMC maintenance visits."
        actions={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New ticket
            </Button>
          )
        }
        className="mb-4"
      />
      <SectionTabs section="/service" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select aria-label="Status" className="sm:w-44" placeholder="All statuses" value={filters.status} onChange={(e) => setParams({ status: e.target.value, page: null })} options={TICKET_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
        <Select aria-label="Priority" className="sm:w-40" placeholder="All priorities" value={filters.priority} onChange={(e) => setParams({ priority: e.target.value, page: null })} options={TICKET_PRIORITIES.map((s) => ({ value: s, label: humanize(s) }))} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!filters.assigneeId} onCheckedChange={(c) => setParams({ mine: c === true ? '1' : null, page: null })} /> Assigned to me
        </label>
      </div>
      <TicketTable data={data?.data} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} />
      <TicketDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
