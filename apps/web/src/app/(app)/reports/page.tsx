'use client';

import { ClipboardList, Download, FileSpreadsheet, FolderKanban, Package, Receipt, ScrollText, Wallet, Wrench } from 'lucide-react';
import { useAudit } from '@/hooks/api/use-misc';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { AuditEntry } from '@/lib/types';
import { formatDateTime, humanize } from '@/lib/utils';
import { API_BASE } from '@/lib/api-client';
import { Require } from '@/components/auth/require';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';

const EXPORTS = [
  { kind: 'projects', label: 'Projects', description: 'Status, phase, progress, contract & collections', icon: FolderKanban },
  { kind: 'leads', label: 'Leads', description: 'Pipeline with source, status and owner', icon: ClipboardList },
  { kind: 'payments', label: 'Payments', description: 'Receipts by mode, type and project', icon: Wallet },
  { kind: 'expenses', label: 'Expenses', description: 'Site & office expenses with approval status', icon: Receipt },
  { kind: 'inventory', label: 'Inventory', description: 'Items, stock on hand and valuation', icon: Package },
  { kind: 'tickets', label: 'Tickets', description: 'Service tickets with SLA and resolution', icon: Wrench },
] as const;

export default function ReportsPage() {
  return (
    <Require permission="reports:read">
      <Reports />
    </Require>
  );
}

function Reports() {
  const canExport = useCan({ permission: 'reports:export', feature: 'reports_export' });
  const canAudit = useCan({ permission: 'audit:read', feature: 'audit_log' });
  return (
    <>
      <PageHeader title="Reports" description="Export data to CSV for your CA, bank or Excel, and review the audit trail." />
      <section aria-labelledby="exports">
        <h2 id="exports" className="mb-3 text-sm font-semibold">
          CSV exports
        </h2>
        {canExport ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORTS.map((e) => (
              <Card key={e.kind} className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary dark:text-blue-400">
                  <e.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{e.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.description}</p>
                </div>
                <a href={`${API_BASE}/reports/${e.kind}.csv`} download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Download /> CSV
                </a>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState compact icon={FileSpreadsheet} title="Exports not available" description="Your role or plan doesn't include CSV exports." />
          </Card>
        )}
      </section>
      {canAudit && <AuditLog />}
    </>
  );
}

function AuditLog() {
  const [params, setParams] = useQueryParams();
  const entity = params.get('entity') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, isLoading, error } = useAudit({ entity, page, limit: 25, sort: '-createdAt' });
  const columns: Column<AuditEntry>[] = [
    { id: 'createdAt', header: 'When', cell: (a) => <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
    { id: 'user', header: 'User', cell: (a) => a.user?.name ?? 'System' },
    { id: 'entity', header: 'Record', cell: (a) => <Badge>{humanize(a.entity)}</Badge>, hideOnMobile: true },
    { id: 'action', header: 'Action', cell: (a) => humanize(a.action), hideOnMobile: true },
    { id: 'summary', header: 'Summary', cell: (a) => <span className="block max-w-md truncate text-muted-foreground" title={a.summary}>{a.summary}</span> },
  ];
  return (
    <section aria-labelledby="audit" className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="audit" className="flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" aria-hidden /> Audit log
        </h2>
        <Select
          aria-label="Record type"
          className="w-44"
          placeholder="All records"
          value={entity}
          onChange={(e) => setParams({ entity: e.target.value, page: null })}
          options={['project', 'lead', 'quotation', 'payment', 'expense', 'document', 'item', 'dispatch', 'ticket', 'user', 'role', 'org'].map((e) => ({ value: e, label: humanize(e) }))}
        />
      </div>
      <DataTable caption="Audit log" columns={columns} data={data?.data} rowKey={(a) => a.id} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} />
    </section>
  );
}
