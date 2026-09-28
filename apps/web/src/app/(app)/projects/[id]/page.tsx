'use client';

import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDocuments } from '@/hooks/api/use-documents';
import { useDispatches } from '@/hooks/api/use-inventory';
import { useProject, useProjectTimeline, useUpdateProject } from '@/hooks/api/use-projects';
import { useQuotations } from '@/hooks/api/use-quotations';
import { useTickets } from '@/hooks/api/use-service';
import { useQueryState } from '@/hooks/use-query-state';
import { useCan, useSession, allows } from '@/hooks/use-session';
import type { Dispatch, Project } from '@/lib/types';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { DispatchDialog } from '@/components/dispatch/dispatch-dialog';
import { DispatchSheet } from '@/components/dispatch/dispatch-sheet';
import { DispatchTable } from '@/components/dispatch/dispatch-table';
import { DocumentsPanel } from '@/components/documents/documents-panel';
import { BoqTab } from '@/components/projects/boq-tab';
import { CommentsTab } from '@/components/projects/comments-tab';
import { ExpensesTab } from '@/components/projects/expenses-tab';
import { OverviewTab } from '@/components/projects/overview-tab';
import { PaymentsTab } from '@/components/projects/payments-tab';
import { ProjectForm, type ProjectFormIn } from '@/components/projects/project-form';
import { ProjectHeader } from '@/components/projects/project-header';
import { WorkflowTab } from '@/components/projects/workflow-tab';
import { QuotationTable } from '@/components/quotations/quotation-table';
import { TicketDialog } from '@/components/service/ticket-dialog';
import { TicketTable } from '@/components/service/ticket-table';
import { ButtonLink, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Breadcrumbs } from '@/components/ui/page-header';
import { Sheet } from '@/components/ui/sheet';
import { PageSkeleton, SkeletonText } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StageDrawer } from '@/components/workflow/stage-drawer';
import type { Gate } from '@/hooks/use-session';

const TABS: { key: string; label: string; gate?: Gate }[] = [
  { key: 'workflow', label: 'Workflow' },
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents', gate: { permission: 'documents:read' } },
  { key: 'boq', label: 'BOQ' },
  { key: 'quotations', label: 'Quotations', gate: { permission: 'quotations:read', feature: 'quotations' } },
  { key: 'payments', label: 'Payments', gate: { permission: 'payments:read' } },
  { key: 'expenses', label: 'Expenses', gate: { permission: 'expenses:read', feature: 'expenses' } },
  { key: 'dispatch', label: 'Dispatch', gate: { permission: 'dispatch:read', feature: 'dispatch' } },
  { key: 'tickets', label: 'Tickets', gate: { permission: 'tickets:read', feature: 'service_tickets' } },
  { key: 'timeline', label: 'Timeline' },
  { key: 'comments', label: 'Comments' },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const { data: project, isLoading, error, refetch } = useProject(id);
  const canDocs = useCan({ permission: 'documents:read' });
  const docs = useDocuments({ projectId: id }, canDocs);
  const [tab, setTab] = useQueryState('tab', 'workflow');
  const [stage, setStage] = useQueryState('stage');
  const [editing, setEditing] = useState(false);

  if (isLoading) return <PageSkeleton cards={4} />;
  if (error || !project) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const tabs = TABS.filter((t) => !t.gate || allows(session, t.gate));
  const documents = docs.data?.data ?? [];

  return (
    <>
      <Breadcrumbs className="mb-3" items={[{ label: 'Projects', href: '/projects' }, { label: project.code }]} />
      <ProjectHeader project={project} onEdit={() => setEditing(true)} />

      <Tabs value={tabs.some((t) => t.key === tab) ? tab : 'workflow'} onValueChange={setTab}>
        <TabsList aria-label="Project sections">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {t.key === 'documents' && project.documentsCount > 0 && <span className="tabular rounded-full bg-muted px-1.5 text-[10px]">{project.documentsCount}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="workflow">
          <WorkflowTab project={project} documents={documents} onOpenStage={setStage} />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab project={project} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel projectId={project.id} documents={documents} loading={docs.isLoading} />
        </TabsContent>
        <TabsContent value="boq">
          <BoqTab key={project.updatedAt} project={project} />
        </TabsContent>
        <TabsContent value="quotations">
          <ProjectQuotations project={project} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab project={project} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="dispatch">
          <ProjectDispatches projectId={project.id} />
        </TabsContent>
        <TabsContent value="tickets">
          <ProjectTickets projectId={project.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <ProjectTimeline projectId={project.id} />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      <StageDrawer project={project} stageKey={stage || null} documents={documents} onOpenChange={(o) => !o && setStage(null)} />
      <EditProjectSheet project={project} open={editing} onOpenChange={setEditing} />
    </>
  );
}

function ProjectQuotations({ project }: { project: Project }) {
  const { data, isLoading, error } = useQuotations({ projectId: project.id, limit: 50 });
  const canWrite = useCan({ permission: 'quotations:write' });
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <ButtonLink href={`/quotations/new?projectId=${project.id}`} size="sm">
            <Plus /> New quotation
          </ButtonLink>
        </div>
      )}
      <QuotationTable data={data?.data} loading={isLoading} error={error} showCustomer={false} />
    </div>
  );
}

function ProjectDispatches({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useDispatches({ projectId, limit: 50 });
  const canWrite = useCan({ permission: 'dispatch:write' });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Dispatch | null>(null);
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Plan dispatch
          </Button>
        </div>
      )}
      <DispatchTable data={data?.data} loading={isLoading} error={error} onOpen={setSelected} showProject={false} />
      <DispatchDialog open={open} onOpenChange={setOpen} projectId={projectId} />
      <DispatchSheet dispatch={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function ProjectTickets({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useTickets({ projectId, limit: 50 });
  const canWrite = useCan({ permission: 'tickets:write' });
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> New ticket
          </Button>
        </div>
      )}
      <TicketTable data={data?.data} loading={isLoading} error={error} showProject={false} />
      <TicketDialog open={open} onOpenChange={setOpen} projectId={projectId} />
    </div>
  );
}

function ProjectTimeline({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useProjectTimeline(projectId);
  return (
    <Card className="p-4 sm:p-6">
      {isLoading && <SkeletonText lines={6} />}
      {error != null && <ErrorState error={error} />}
      {data && <ActivityFeed items={data} />}
    </Card>
  );
}

function EditProjectSheet({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateProject(project.id);
  const defaults: ProjectFormIn = {
    customer: {
      name: project.customer.name,
      phone: project.customer.phone,
      email: project.customer.email ?? '',
      consumerNumber: project.customer.consumerNumber,
      address: { line1: '', city: '', district: '', state: '', pincode: '', ...project.customer.address },
    },
    customerType: project.customerType,
    connectionType: project.connectionType,
    systemSizeKw: project.systemSizeKw,
    contractValue: project.contractValue,
    expectedSubsidy: project.expectedSubsidy,
    team: {
      salesId: project.team?.sales?.id,
      managerId: project.team?.manager?.id,
      engineerId: project.team?.engineer?.id,
      operationsId: project.team?.operations?.id,
    },
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Edit ${project.code}`} size="xl">
      {open && (
        <ProjectForm
          defaultValues={defaults}
          submitLabel="Save changes"
          submitting={update.isPending}
          onSubmit={(v) => update.mutate(v, { onSuccess: () => onOpenChange(false) })}
        />
      )}
    </Sheet>
  );
}
