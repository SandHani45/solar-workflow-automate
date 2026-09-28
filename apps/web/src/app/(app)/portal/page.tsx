'use client';

import { CalendarDays, Check, Download, FileText, LifeBuoy, Phone, Plus, Sun, Zap } from 'lucide-react';
import { useState } from 'react';
import { DOCUMENT_TYPE_LABELS, humanize } from '@solar/shared';
import { useDocuments } from '@/hooks/api/use-documents';
import { useProject, useProjectFinancials, useProjects } from '@/hooks/api/use-projects';
import { useTickets } from '@/hooks/api/use-service';
import { useCan, useSession } from '@/hooks/use-session';
import type { Project } from '@/lib/types';
import { cn, formatDate, formatINR, formatKw } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';
import { projectPhases } from '@/lib/workflow';
import { GooeyProgress } from '@/components/effects';
import { SlaIndicator } from '@/components/service/sla-indicator';
import { TicketDialog } from '@/components/service/ticket-dialog';
import { TicketDetail } from '@/components/service/ticket-detail';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/** Friendly phase copy for customers (no internal jargon). */
const CUSTOMER_COPY: Record<string, string> = {
  sales: 'Site survey and your final quotation',
  documentation: 'Your documents, subsidy application and advance payment',
  logistics: 'Materials checked and delivered to your site',
  installation: 'Our engineers install your solar system',
  accounts: 'Warranty cards, invoice and certificates prepared',
  net_metering: 'DISCOM inspection, net meter and your handover training',
  closure: 'Final settlement — your system is all yours',
};

export default function PortalPage() {
  const session = useSession();
  const { data, isLoading, error, refetch } = useProjects({ limit: 20 });
  const [selected, setSelected] = useState<string>('');
  if (isLoading) return <PageSkeleton cards={0} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const projects = data?.data ?? [];
  if (projects.length === 0) {
    return <EmptyState icon={Sun} title={`Welcome, ${session.user.name.split(' ')[0]}`} description="Your project will appear here as soon as our team sets it up. Please contact us if you expected to see it." />;
  }
  const projectId = selected || projects[0]!.id;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-2xl font-semibold tracking-tight">{session.user.name}</h1>
        </div>
        {projects.length > 1 && (
          <Select aria-label="Project" className="w-64" value={projectId} onChange={(e) => setSelected(e.target.value)} options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${formatKw(p.systemSizeKw)}` }))} />
        )}
      </div>
      <PortalProject key={projectId} id={projectId} />
    </div>
  );
}

function PortalProject({ id }: { id: string }) {
  const { data: project, isLoading } = useProject(id);
  if (isLoading || !project) return <Skeleton className="h-96 rounded-2xl" />;
  return (
    <>
      <ProgressHero project={project} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <PhaseTracker project={project} />
        <div className="space-y-5">
          <PaymentsCard project={project} />
          <DocumentsCard projectId={project.id} />
        </div>
      </div>
      <TicketsCard projectId={project.id} />
    </>
  );
}

function ProgressHero({ project }: { project: Project }) {
  const done = project.status === 'completed';
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-[#0b1a45] via-[#1e3a8a] to-[#2563eb] p-5 text-white sm:p-7">
        <div aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-100/80">{project.code}</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <Zap className="size-6 text-amber-300" aria-hidden /> {formatKw(project.systemSizeKw)} rooftop solar
            </p>
            <p className="mt-1 text-sm text-blue-100/85">{done ? 'Your system is complete. Thank you for going solar!' : CUSTOMER_COPY[project.currentPhase]}</p>
          </div>
          {project.installationDate && (
            <div className="rounded-xl bg-white/10 px-4 py-2.5 text-sm backdrop-blur">
              <p className="flex items-center gap-1.5 text-xs text-blue-100/80">
                <CalendarDays className="size-3.5" aria-hidden /> Installation
              </p>
              <p className="font-semibold">{formatDate(project.installationDate, 'EEE, d MMM')}</p>
            </div>
          )}
        </div>
        <div className="relative mt-6">
          <div className="mb-1.5 flex justify-between text-xs">
            <span>Overall progress</span>
            <span className="tabular font-semibold">{project.progress}%</span>
          </div>
          <GooeyProgress
            value={project.progress}
            label="Overall progress"
            steps={projectPhases(project).map(({ phase, stages, done }) => ({ key: phase.key, label: phase.name, fraction: stages.length ? done / stages.length : 1 }))}
          />
        </div>
      </div>
    </Card>
  );
}

function PhaseTracker({ project }: { project: Project }) {
  const phases = projectPhases(project);
  const currentIdx = phases.findIndex((p) => p.phase.key === project.currentPhase);
  return (
    <Card>
      <CardHeader title="Your installation journey" />
      <CardContent>
        <ol className="relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-0.5 before:bg-border">
          {phases.map(({ phase, stages, done }, i) => {
            const complete = done === stages.length;
            const current = i === currentIdx && !complete;
            return (
              <li key={phase.key} className="relative flex gap-4">
                <span
                  className={cn(
                    'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    complete ? 'bg-emerald-500 text-white' : current ? cn(TONE_STYLES[phase.color].dot, 'text-white ring-4 ring-primary-soft') : 'border-2 border-border bg-card text-muted-foreground',
                  )}
                >
                  {complete ? <Check className="size-4" strokeWidth={3} /> : phase.order}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={cn('text-sm font-semibold', !complete && !current && 'text-muted-foreground')}>
                    {phase.name}
                    {current && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">In progress</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{CUSTOMER_COPY[phase.key]}</p>
                  {current && (
                    <ul className="mt-2 space-y-1">
                      {stages.map((s) => (
                        <li key={s.def.key} className="flex items-center gap-2 text-xs">
                          {s.state.status === 'completed' || s.state.status === 'skipped' ? <Check className="size-3.5 text-emerald-500" aria-label="Done" /> : <span className="size-3.5 rounded-full border border-border" aria-label="Pending" />}
                          <span className={cn(s.state.status === 'completed' && 'text-muted-foreground')}>{s.def.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ project }: { project: Project }) {
  const canPayments = useCan({ permission: 'payments:read' });
  const { data } = useProjectFinancials(project.id, canPayments);
  if (!canPayments) return null;
  const contract = data?.contractValue ?? project.contractValue;
  const received = data?.received ?? project.financialSummary?.received ?? 0;
  return (
    <Card>
      <CardHeader title="Payments" />
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Total', contract],
            ['Paid', received],
            ['Balance', Math.max(0, contract - received)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted/60 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">{k}</p>
              <p className="tabular text-sm font-semibold">{formatINR(Number(v))}</p>
            </div>
          ))}
        </div>
        <Progress value={contract ? (received / contract) * 100 : 0} barClassName="from-emerald-500 to-emerald-400" label="Paid" />
        <ul className="divide-y divide-border text-sm">
          {data?.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                {formatDate(p.receivedAt)} <span className="text-xs text-muted-foreground">· {humanize(p.mode)}</span>
              </span>
              <span className="tabular font-medium">{formatINR(p.amount)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DocumentsCard({ projectId }: { projectId: string }) {
  const canDocs = useCan({ permission: 'documents:read' });
  const { data, isLoading } = useDocuments({ projectId }, canDocs);
  if (!canDocs) return null;
  return (
    <Card>
      <CardHeader title="Your documents" description="Invoice, warranty, certificates and photos" />
      {isLoading && <Skeleton className="m-4 h-20" />}
      {data?.data.length === 0 && <EmptyState compact icon={FileText} title="No documents yet" />}
      <ul className="divide-y divide-border">
        {data?.data.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{DOCUMENT_TYPE_LABELS[d.type]}</span>
              <span className="block truncate text-xs text-muted-foreground">{d.originalName}</span>
            </span>
            <a href={d.url} download className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted" aria-label={`Download ${d.originalName}`}>
              <Download className="size-3.5" /> Download
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TicketsCard({ projectId }: { projectId: string }) {
  const session = useSession();
  const canTickets = useCan({ permission: 'tickets:read', feature: 'service_tickets' });
  const canRaise = useCan({ permission: 'tickets:write' });
  const { data } = useTickets({ projectId, limit: 20, sort: '-createdAt' }, canTickets);
  const [raising, setRaising] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!canTickets) return null;
  const phone = session.org?.settings.phone;
  return (
    <Card>
      <CardHeader
        title="Service requests"
        description="Something not right? We're here to help."
        action={
          <>
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-blue-400">
                <Phone className="size-3.5" /> Call us
              </a>
            )}
            {canRaise && (
              <Button size="sm" onClick={() => setRaising(true)}>
                <Plus /> Report an issue
              </Button>
            )}
          </>
        }
      />
      {data?.data.length === 0 && <EmptyState compact icon={LifeBuoy} title="No service requests" description="If your system has a problem, report it here and track the fix." />}
      <ul className="divide-y divide-border">
        {data?.data.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {t.code} · {formatDate(t.createdAt)}
                </span>
              </span>
              <SlaIndicator ticket={t} />
              <StatusBadge status={t.status} />
            </button>
          </li>
        ))}
      </ul>
      <TicketDialog open={raising} onOpenChange={setRaising} projectId={projectId} customerMode />
      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title="Service request" size="xl">
        {openId && <TicketDetail id={openId} customerMode />}
      </Sheet>
    </Card>
  );
}
