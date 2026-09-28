'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Boxes, HandCoins, IndianRupee, Phone, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { humanize } from '@solar/shared';
import { useFinanceDashboard } from '@/hooks/api/use-finance';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan, useSession } from '@/hooks/use-session';
import { cn, formatDate, formatINR, formatINRCompact, formatMonth } from '@/lib/utils';
import type { FinanceDashboard } from '@/lib/types';
import { CompareLineChart, DonutChart, SimpleBarChart } from '@/components/charts/charts';
import { OrbsLoader } from '@/components/effects';
import { resolveNav } from '@/components/layout/nav';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DateInput } from '@/components/ui/date-input';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';

type Pending = FinanceDashboard['pendingCustomers'][number];
type ProfitRow = FinanceDashboard['projectProfit'][number];

export default function FinanceOverviewPage() {
  const session = useSession();
  const router = useRouter();
  const allowed = useCan({ permission: 'finance:read', feature: 'finance_dashboard' });
  // Payments-only roles land on the first finance page they can see.
  const firstAllowed = resolveNav(session).find((i) => i.basePath === '/finance')?.href;
  useEffect(() => {
    if (!allowed && firstAllowed && firstAllowed !== '/finance') router.replace(firstAllowed);
  }, [allowed, firstAllowed, router]);
  if (!allowed) return <PageSkeleton />;
  return <FinanceOverview />;
}

function FinanceOverview() {
  const [params, setParams] = useQueryParams();
  const range = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
  const canPartners = useCan({ permission: 'finance:partners', feature: 'partner_profit_split' });
  const { data, isLoading, error, refetch } = useFinanceDashboard(range);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const t = data?.totals;

  const pendingCols: Column<Pending>[] = [
    { id: 'customer', header: 'Customer', cell: (r) => <Link href={`/projects/${r.projectId}?tab=payments`} className="font-medium hover:underline">{r.customerName}<span className="block text-xs font-normal text-muted-foreground">{r.code}</span></Link> },
    { id: 'contract', header: 'Contract', align: 'right', cell: (r) => formatINR(r.contractValue), hideOnMobile: true },
    { id: 'received', header: 'Received', align: 'right', cell: (r) => formatINR(r.received), hideOnMobile: true },
    { id: 'pending', header: 'Pending', align: 'right', sortValue: (r) => r.pending, cell: (r) => <span className="tabular font-semibold text-amber-700 dark:text-amber-400">{formatINR(r.pending)}</span> },
    { id: 'last', header: 'Last paid', cell: (r) => formatDate(r.lastPaymentAt, 'd MMM'), hideOnMobile: true },
    {
      id: 'call',
      header: <span className="sr-only">Call</span>,
      align: 'right',
      cell: (r) => (
        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted" aria-label={`Call ${r.customerName}`}>
          <Phone className="size-3.5" /> Call
        </a>
      ),
    },
  ];

  const profitCols: Column<ProfitRow>[] = [
    { id: 'customer', header: 'Project', cell: (r) => <Link href={`/projects/${r.projectId}`} className="hover:underline">{r.code} <span className="text-muted-foreground">{r.customerName}</span></Link> },
    { id: 'received', header: 'Received', align: 'right', sortValue: (r) => r.received, cell: (r) => formatINR(r.received) },
    { id: 'expenses', header: 'Expenses', align: 'right', sortValue: (r) => r.expenses, cell: (r) => formatINR(r.expenses), hideOnMobile: true },
    { id: 'material', header: 'Material', align: 'right', sortValue: (r) => r.materialCost, cell: (r) => formatINR(r.materialCost), hideOnMobile: true },
    { id: 'profit', header: 'Profit', align: 'right', sortValue: (r) => r.profit, cell: (r) => <span className={cn('tabular font-semibold', r.profit < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400')}>{formatINR(r.profit)}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="From" className="w-40">
          <DateInput value={range.from} onChange={(e) => setParams({ from: e.target.value })} />
        </FormField>
        <FormField label="To" className="w-40">
          <DateInput value={range.to} onChange={(e) => setParams({ to: e.target.value })} />
        </FormField>
        {(range.from || range.to) && (
          <button type="button" className="mb-2 text-xs font-medium text-primary dark:text-blue-400" onClick={() => setParams({ from: null, to: null })}>
            All time
          </button>
        )}
      </div>

      {isLoading && <OrbsLoader caption="Crunching collections, expenses and profit…" className="py-2" />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contract value" value={formatINRCompact(t?.contractValue)} icon={Wallet} loading={isLoading} />
        <StatCard label="Received" value={formatINRCompact(t?.received)} icon={IndianRupee} tone="green" loading={isLoading} href="/finance/payments" />
        <StatCard label="Pending from customers" value={formatINRCompact(t?.pending)} icon={HandCoins} tone="amber" loading={isLoading} />
        <StatCard label="Profit" value={formatINRCompact(t?.profit)} icon={TrendingUp} tone={t && t.profit < 0 ? 'red' : 'green'} loading={isLoading} hint="Received − expenses − material" />
        <StatCard label="Expenses" value={formatINRCompact(t?.expenses)} icon={Receipt} tone="orange" loading={isLoading} href="/finance/expenses" />
        <StatCard label="Material cost" value={formatINRCompact(t?.materialCost)} icon={Boxes} tone="purple" loading={isLoading} />
        <StatCard label="Advances outstanding" value={formatINRCompact(t?.advancesOutstanding)} icon={PiggyBank} tone="teal" loading={isLoading} href="/finance/advances" />
        <StatCard label="Stock value" value={formatINRCompact(t?.stockValue)} icon={Boxes} tone="blue" loading={isLoading} href="/inventory/summary" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Received by payment mode" />
          <CardContent>{isLoading ? <Skeleton className="h-56" /> : data?.receivedByMode.length ? <DonutChart data={data.receivedByMode.map((r) => ({ name: humanize(r.mode), value: r.amount }))} /> : <EmptyState compact title="No payments in range" />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Expenses by category" />
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56" />
            ) : data?.expensesByCategory.length ? (
              <SimpleBarChart data={[...data.expensesByCategory].sort((a, b) => b.amount - a.amount).map((e) => ({ category: humanize(e.category), amount: e.amount }))} xKey="category" yKey="amount" name="Expenses" format="inr" layout="vertical" height={Math.max(200, data.expensesByCategory.length * 34)} />
            ) : (
              <EmptyState compact title="No expenses in range" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Monthly received vs expenses" description="Last 12 months" />
        <CardContent>{isLoading ? <Skeleton className="h-64" /> : <CompareLineChart data={(data?.monthly ?? []).map((m) => ({ ...m, month: formatMonth(m.month) }))} xKey="month" series={[{ key: 'received', name: 'Received' }, { key: 'expenses', name: 'Expenses' }]} />}</CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Pending customers</h2>
        <DataTable columns={pendingCols} data={data?.pendingCustomers} rowKey={(r) => r.projectId} loading={isLoading} empty={<EmptyState compact title="Everyone has paid up" />} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Advances outstanding" action={<Link href="/finance/advances" className="text-xs font-medium text-primary dark:text-blue-400">Manage →</Link>} />
          <ul className="divide-y divide-border">
            {data?.advances.length === 0 && <EmptyState compact title="No outstanding advances" />}
            {data?.advances.map((a) => (
              <li key={`${a.personName}-${a.kind}`} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>
                  {a.personName} <span className="text-xs text-muted-foreground">({humanize(a.kind)})</span>
                </span>
                <span className="tabular font-medium">{formatINR(a.outstanding)}</span>
              </li>
            ))}
          </ul>
        </Card>
        {canPartners && data?.partnerSplit && (
          <Card>
            <CardHeader title="Partner profit split" description="Share of profit net of advances taken" action={<Link href="/finance/partners" className="text-xs font-medium text-primary dark:text-blue-400">Partners →</Link>} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Partner</th>
                    <th className="px-3 py-2 text-right font-medium">Share</th>
                    <th className="px-3 py-2 text-right font-medium">Profit share</th>
                    <th className="px-3 py-2 text-right font-medium">Advance</th>
                    <th className="px-5 py-2 text-right font-medium">Net payable</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partnerSplit.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="px-5 py-2 font-medium">{p.name}</td>
                      <td className="tabular px-3 py-2 text-right">{p.sharePercent}%</td>
                      <td className="tabular px-3 py-2 text-right">{formatINR(p.share)}</td>
                      <td className="tabular px-3 py-2 text-right text-muted-foreground">{formatINR(p.advanceTaken)}</td>
                      <td className={cn('tabular px-5 py-2 text-right font-semibold', p.netPayable < 0 && 'text-rose-600')}>{formatINR(p.netPayable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Profit by project</h2>
        <DataTable columns={profitCols} data={data?.projectProfit} rowKey={(r) => r.projectId} loading={isLoading} empty={<EmptyState compact title="No project data yet" />} />
      </section>
    </div>
  );
}
