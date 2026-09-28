'use client';

import Link from 'next/link';
import { CalendarCheck, Plus } from 'lucide-react';
import { useState } from 'react';
import { addYears, isPast, parseISO } from 'date-fns';
import { amcSchema } from '@solar/shared';
import { useAmcContracts, useAmcVisit, useCreateAmc } from '@/hooks/api/use-service';
import { useCan } from '@/hooks/use-session';
import type { AmcContract } from '@/lib/types';
import { cn, formatDate, formatINR, toDateInputValue } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { SectionTabs } from '@/components/layout/section-tabs';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export default function AmcPage() {
  return (
    <Require permission="tickets:read" feature="amc_contracts">
      <Amc />
    </Require>
  );
}

function Amc() {
  const canWrite = useCan({ permission: 'tickets:write' });
  const { data, isLoading, error } = useAmcContracts({ limit: 50 });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Service"
        description="Annual maintenance contracts with scheduled cleaning & inspection visits."
        className="mb-4"
        actions={
          canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New AMC
            </Button>
          )
        }
      />
      <SectionTabs section="/service" />
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      {error != null && <ErrorState error={error} />}
      {data?.data.length === 0 && <EmptyState icon={CalendarCheck} title="No AMC contracts" description="Offer annual cleaning & maintenance after handover for recurring revenue." />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.data.map((c) => <AmcCard key={c.id} amc={c} canWrite={canWrite} />)}
      </div>
      <AmcDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function AmcCard({ amc, canWrite }: { amc: AmcContract; canWrite: boolean }) {
  const visit = useAmcVisit();
  const done = amc.visits.filter((v) => v.done).length;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${amc.projectId}`} className="font-semibold hover:underline">
            {amc.project?.customerName ?? amc.project?.code ?? 'Project'}
          </Link>
          <p className="text-xs text-muted-foreground">
            {amc.project?.code} · {formatDate(amc.startDate)} – {formatDate(amc.endDate)}
          </p>
        </div>
        <p className="tabular text-sm font-semibold">{formatINR(amc.amount)}</p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress value={amc.visits.length ? (done / amc.visits.length) * 100 : 0} className="h-1.5" barClassName="from-emerald-500 to-emerald-400" label="Visits done" />
        <span className="tabular text-xs text-muted-foreground">
          {done}/{amc.visits.length}
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {amc.visits.map((v) => {
          const overdue = !v.done && isPast(parseISO(v.dueDate));
          return (
            <li key={v.id}>
              <label className={cn('flex min-h-10 items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50', !canWrite && 'pointer-events-none')}>
                <Checkbox checked={v.done} disabled={!canWrite || visit.isPending} onCheckedChange={(c) => visit.mutate({ amcId: amc.id, visitId: v.id, done: c === true })} />
                <span className={cn('flex-1', v.done && 'text-muted-foreground line-through')}>Visit due {formatDate(v.dueDate)}</span>
                {v.done && v.doneAt && <span className="text-xs text-muted-foreground">done {formatDate(v.doneAt, 'd MMM')}</span>}
                {overdue && <span className="text-xs font-semibold text-rose-600">Overdue</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AmcDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateAmc();
  const [v, setV] = useState(() => {
    const today = new Date();
    return { projectId: '', startDate: toDateInputValue(today), endDate: toDateInputValue(addYears(today, 1)), visitsPerYear: '4', amount: '', notes: '' };
  });
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const parsed = amcSchema.safeParse({ ...v, notes: v.notes || undefined });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    setError(null);
    create.mutate(parsed.data, { onSuccess: () => onOpenChange(false) });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New AMC contract"
      description="Visits are generated automatically across the contract period."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create contract
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Project" required className="sm:col-span-2" htmlFor="amc-project">
          <ProjectPicker id="amc-project" value={v.projectId} onChange={(p) => setV((s) => ({ ...s, projectId: p.id }))} />
        </FormField>
        <FormField label="Start">
          <DateInput value={v.startDate} onChange={(e) => setV((s) => ({ ...s, startDate: e.target.value }))} />
        </FormField>
        <FormField label="End">
          <DateInput value={v.endDate} onChange={(e) => setV((s) => ({ ...s, endDate: e.target.value }))} />
        </FormField>
        <FormField label="Visits per year">
          <Input type="number" min={1} max={52} value={v.visitsPerYear} onChange={(e) => setV((s) => ({ ...s, visitsPerYear: e.target.value }))} />
        </FormField>
        <FormField label="Contract amount">
          <CurrencyInput value={v.amount} onChange={(e) => setV((s) => ({ ...s, amount: e.target.value }))} />
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          <Input value={v.notes} onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))} />
        </FormField>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </Dialog>
  );
}
