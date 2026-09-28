'use client';

import Link from 'next/link';
import { AlarmClock, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FolderKanban, IndianRupee, Inbox, PackageX, TrendingUp, Wrench } from 'lucide-react';
import { PHASES } from '@solar/shared';
import { useDashboard } from '@/hooks/api/use-misc';
import { useCan, useSession } from '@/hooks/use-session';
import type { MyTask } from '@/lib/types';
import { cn, formatDate, formatINRCompact, formatMonth, formatRelative } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { Require } from '@/components/auth/require';
import { SimpleBarChart } from '@/components/charts/charts';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StageStatusBadge } from '@/components/workflow/stage-status';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  return (
    <Require permission="dashboard:read">
      <Dashboard />
    </Require>
  );
}

function Dashboard() {
  const session = useSession();
  const canFinance = useCan({ permission: 'finance:read' });
  const { data, isLoading, error, refetch } = useDashboard();
  const k = data?.kpis;

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const phaseData = PHASES.map((p) => ({ name: p.name.replace(' & Handover', '').replace(' & Documentation', ''), count: data?.projectsByPhase.find((x) => x.phase === p.key)?.count ?? 0 }));
  const tasks = [...(data?.myTasks ?? [])].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));

  return (
    <>
      <PageHeader title={`${greeting()}, ${session.user.name.split(' ')[0]}`} description={`Here’s what’s happening at ${session.org?.name ?? 'your organisation'} today.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active projects" value={k?.activeProjects ?? 0} icon={FolderKanban} loading={isLoading} href="/projects?status=active" />
        <StatCard label="Overdue stages" value={k?.overdueStages ?? 0} icon={AlarmClock} tone="red" loading={isLoading} emphasis={k && k.overdueStages > 0 ? 'danger' : undefined} hint="Past their SLA" />
        <StatCard label="New leads" value={k?.newLeads ?? 0} icon={ClipboardList} tone="teal" loading={isLoading} href="/leads" hint="This month" />
        <StatCard label="Pipeline value" value={formatINRCompact(k?.pipelineValue)} icon={TrendingUp} tone="purple" loading={isLoading} hint="Open leads & projects" />
        {canFinance && <StatCard label="Collected this month" value={formatINRCompact(k?.collectedThisMonth)} icon={IndianRupee} tone="green" loading={isLoading} href="/finance" />}
        <StatCard label="Completed this month" value={k?.completedThisMonth ?? 0} icon={CheckCircle2} tone="green" loading={isLoading} />
        <StatCard label="Open tickets" value={k?.openTickets ?? 0} icon={Wrench} tone="orange" loading={isLoading} href="/service" />
        <StatCard label="Low-stock items" value={k?.lowStockItems ?? 0} icon={PackageX} tone="amber" loading={isLoading} href="/inventory?lowStock=true" emphasis={k && k.lowStockItems > 0 ? 'warning' : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="My tasks" description="Stages your role owns or you're assigned to" action={tasks.length > 0 && <span className="tabular text-xs text-muted-foreground">{tasks.length} open</span>} />
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            )}
            {!isLoading && tasks.length === 0 && <EmptyState compact icon={Inbox} title="Inbox zero" description="No workflow stages are waiting on you." />}
            <ul className="divide-y divide-border" data-testid="my-tasks">
              {tasks.map((t) => (
                <TaskRow key={`${t.projectId}-${t.stageKey}`} task={t} />
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Projects by phase" description="Where active projects are right now" />
          <CardContent>
            {isLoading ? <Skeleton className="h-60" /> : <SimpleBarChart data={phaseData} xKey="name" yKey="count" name="Projects" layout="vertical" height={260} colors={PHASES.map((p) => TONE_STYLES[p.color].hex)} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Upcoming installations" description="Next scheduled rooftops" />
          <ul className="divide-y divide-border">
            {!isLoading && (data?.upcomingInstallations.length ?? 0) === 0 && <EmptyState compact icon={CalendarDays} title="Nothing scheduled" />}
            {data?.upcomingInstallations.map((u) => (
              <li key={u.projectId}>
                <Link href={`/projects/${u.projectId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border py-1">
                    <span className="text-[10px] font-medium text-rose-600 uppercase">{formatDate(u.date, 'MMM')}</span>
                    <span className="tabular text-base leading-none font-semibold">{formatDate(u.date, 'd')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.customerName}</span>
                    <span className="block text-xs text-muted-foreground">{u.projectCode}</span>
                  </span>
                  {u.engineer && (
                    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <Avatar name={u.engineer.name} size="xs" /> {u.engineer.name}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {canFinance && data?.monthlyCollections && (
          <Card>
            <CardHeader title="Monthly collections" description="Payments received, last 6 months" action={<Link href="/finance" className="text-xs font-medium text-primary dark:text-blue-400">Finance →</Link>} />
            <CardContent>
              <SimpleBarChart data={data.monthlyCollections.map((m) => ({ month: formatMonth(m.month), amount: m.amount }))} xKey="month" yKey="amount" name="Collected" format="inr" />
            </CardContent>
          </Card>
        )}

        <Card className={cn(!(canFinance && data?.monthlyCollections) && 'xl:col-span-1')}>
          <CardHeader title="Recent activity" />
          <CardContent className="max-h-[420px] overflow-y-auto">{isLoading ? <Skeleton className="h-40" /> : <ActivityFeed items={data?.recentActivity ?? []} linkEntities />}</CardContent>
        </Card>
      </div>
    </>
  );
}

function TaskRow({ task }: { task: MyTask }) {
  return (
    <li>
      <Link
        href={`/projects/${task.projectId}?stage=${task.stageKey}`}
        className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5', task.overdue && 'bg-rose-50/60 dark:bg-rose-500/5')}
      >
        <span className={cn('size-2 shrink-0 rounded-full', task.overdue ? 'bg-rose-500' : 'bg-blue-500')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{task.stageName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {task.projectCode} · {task.customerName}
          </span>
        </span>
        <span className="hidden sm:block">
          <StageStatusBadge status={task.status} />
        </span>
        {task.dueAt && (
          <span className={cn('w-24 shrink-0 text-right text-xs', task.overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            {task.overdue ? `Overdue ${formatRelative(task.dueAt).replace(' ago', '')}` : `Due ${formatDate(task.dueAt, 'd MMM')}`}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

