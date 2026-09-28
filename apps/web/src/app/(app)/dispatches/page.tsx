'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DISPATCH_STATUSES, humanize } from '@solar/shared';
import { useDispatches } from '@/hooks/api/use-inventory';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { Dispatch } from '@/lib/types';
import { Require } from '@/components/auth/require';
import { DispatchDialog } from '@/components/dispatch/dispatch-dialog';
import { DispatchSheet } from '@/components/dispatch/dispatch-sheet';
import { DispatchTable } from '@/components/dispatch/dispatch-table';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';

export default function DispatchesPage() {
  return (
    <Require permission="dispatch:read" feature="dispatch">
      <Dispatches />
    </Require>
  );
}

function Dispatches() {
  const canWrite = useCan({ permission: 'dispatch:write' });
  const [params, setParams] = useQueryParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, isLoading, error } = useDispatches({ status, page, limit: 20, sort: '-scheduledDate' });
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Derive from the list so the sheet reflects status changes after refetch.
  const selected: Dispatch | null = data?.data.find((d) => d.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Dispatches"
        description="Material movement from warehouse to site, from packing to unloading."
        actions={
          canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Plan dispatch
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Select aria-label="Status" className="sm:w-48" placeholder="All statuses" value={status} onChange={(e) => setParams({ status: e.target.value, page: null })} options={DISPATCH_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
      </div>
      <DispatchTable data={data?.data} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} onOpen={(d) => setSelectedId(d.id)} />
      <DispatchDialog open={creating} onOpenChange={setCreating} />
      <DispatchSheet dispatch={selected} onOpenChange={(o) => !o && setSelectedId(null)} />
    </>
  );
}
