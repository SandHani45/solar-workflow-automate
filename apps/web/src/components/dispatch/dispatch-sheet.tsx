'use client';

import { Phone, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DISPATCH_STATUSES, humanize, type DispatchStatus } from '@solar/shared';
import { useDispatchStatus } from '@/hooks/api/use-inventory';
import { useCan } from '@/hooks/use-session';
import type { Dispatch } from '@/lib/types';
import { formatAddress, formatDate, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';

const FLOW: DispatchStatus[] = DISPATCH_STATUSES.filter((s) => s !== 'cancelled');

/** Dispatch detail with lifecycle stepper and the next-status action. */
export function DispatchSheet({ dispatch, onOpenChange }: { dispatch: Dispatch | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet
      open={!!dispatch}
      onOpenChange={onOpenChange}
      title={dispatch ? `Dispatch ${dispatch.code}` : 'Dispatch'}
      description={dispatch?.project ? `${dispatch.project.code} · ${dispatch.project.customerName ?? ''}` : undefined}
      eyebrow={dispatch && <StatusBadge status={dispatch.status} />}
    >
      {dispatch && <DispatchBody key={`${dispatch.id}-${dispatch.status}`} dispatch={dispatch} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function DispatchBody({ dispatch, onDone }: { dispatch: Dispatch; onDone: () => void }) {
  const canWrite = useCan({ permission: 'dispatch:write' });
  const setStatus = useDispatchStatus(dispatch.id);
  const [note, setNote] = useState('');
  const idx = FLOW.indexOf(dispatch.status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : undefined;
  const cancelled = dispatch.status === 'cancelled';

  const move = (status: DispatchStatus) => setStatus.mutate({ status, note: note || undefined }, { onSuccess: onDone });

  return (
    <div className="space-y-6">
      <Stepper steps={FLOW.map((s) => ({ key: s, label: humanize(s) }))} current={cancelled ? 'planned' : dispatch.status} failed={cancelled} />

      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Scheduled</dt>
          <dd className="font-medium">{formatDate(dispatch.scheduledDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Vehicle</dt>
          <dd className="font-medium">{dispatch.vehicleNo || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Driver</dt>
          <dd className="font-medium">
            {dispatch.driverName || '—'}
            {dispatch.driverPhone && (
              <a href={`tel:${dispatch.driverPhone}`} className="ml-2 inline-flex items-center gap-1 text-xs text-primary dark:text-blue-400">
                <Phone className="size-3" aria-hidden /> Call
              </a>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Project</dt>
          <dd className="font-medium">
            <Link href={`/projects/${dispatch.projectId}`} className="text-primary hover:underline dark:text-blue-400">
              {dispatch.project?.code ?? 'Open project'}
            </Link>
          </dd>
        </div>
        {dispatch.project?.address && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Deliver to</dt>
            <dd>{formatAddress(dispatch.project.address)}</dd>
          </div>
        )}
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Items ({dispatch.items.length})</h3>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {dispatch.items.map((it) => (
            <li key={it.itemId} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                {it.name ?? it.itemId}
                {it.sku && <span className="ml-1 text-xs text-muted-foreground">{it.sku}</span>}
              </span>
              <span className="tabular font-medium">
                {it.quantity} {it.unit ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {dispatch.history && dispatch.history.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">History</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {dispatch.history.map((h, i) => (
              <li key={`${h.status}-${i}`}>
                <span className="font-medium text-foreground">{humanize(h.status)}</span> · {formatDateTime(h.at)}
                {h.by && ` · ${h.by.name}`}
                {h.note && ` — ${h.note}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canWrite && !cancelled && dispatch.status !== 'unloaded' && (
        <section className="space-y-3 rounded-xl border border-border p-3">
          <FormField label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Loaded 14 panels, driver Ramesh" />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {next && (
              <Button onClick={() => move(next)} loading={setStatus.isPending} className="flex-1 sm:flex-none">
                <Truck /> Mark {humanize(next).toLowerCase()}
              </Button>
            )}
            <Button variant="ghost" className="text-rose-600" onClick={() => move('cancelled')} disabled={setStatus.isPending}>
              Cancel dispatch
            </Button>
          </div>
          {next === 'in_transit' && <p className="text-xs text-muted-foreground">Going in transit issues the stock from the warehouse and books material cost to the project.</p>}
        </section>
      )}
    </div>
  );
}
