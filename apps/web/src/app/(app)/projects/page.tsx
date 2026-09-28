'use client';

import { useRouter } from 'next/navigation';
import { Columns3, FolderKanban, List, Plus } from 'lucide-react';
import { PHASES, PROJECT_STATUSES, humanize } from '@solar/shared';
import { useProjectBoard, useProjects } from '@/hooks/api/use-projects';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { Project } from '@/lib/types';
import { formatINR, formatKw } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { ProjectBoardCard } from '@/components/projects/project-board-card';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KanbanBoard } from '@/components/ui/kanban-board';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';
import { PhaseBadge } from '@/components/workflow/phase-badge';

export default function ProjectsPage() {
  return (
    <Require permission="projects:read">
      <ProjectsView />
    </Require>
  );
}

function ProjectsView() {
  const router = useRouter();
  const canCreate = useCan({ permission: 'projects:write' });
  const [params, setParams] = useQueryParams();
  const view = params.get('view') === 'board' ? 'board' : 'list';
  const filters = { q: params.get('q') ?? '', phase: params.get('phase') ?? '', status: params.get('status') ?? '', page: Number(params.get('page') ?? 1), sort: params.get('sort') ?? '-createdAt' };
  const list = useProjects({ ...filters, limit: 20 });
  const board = useProjectBoard(view === 'board');

  const columns: Column<Project>[] = [
    {
      id: 'code',
      header: 'Project',
      sortValue: (p) => p.code,
      cell: (p) => (
        <div className="min-w-44">
          <p className="font-medium">{p.customer.name}</p>
          <p className="tabular text-xs text-muted-foreground">
            {p.code} · {p.customer.phone}
          </p>
        </div>
      ),
    },
    { id: 'currentPhase', header: 'Phase', cell: (p) => <PhaseBadge phase={p.currentPhase} /> },
    {
      id: 'progress',
      header: 'Progress',
      sortValue: (p) => p.progress,
      cell: (p) => (
        <div className="flex w-32 items-center gap-2">
          <Progress value={p.progress} className="h-1.5" label={`${p.code} progress`} />
          <span className="tabular w-8 text-right text-xs text-muted-foreground">{p.progress}%</span>
        </div>
      ),
    },
    { id: 'systemSizeKw', header: 'Size', sortValue: (p) => p.systemSizeKw, cell: (p) => formatKw(p.systemSizeKw), hideOnMobile: true },
    { id: 'contractValue', header: 'Contract', align: 'right', sortValue: (p) => p.contractValue, cell: (p) => <span className="tabular">{formatINR(p.contractValue)}</span>, hideOnMobile: true },
    { id: 'pending', header: 'Pending', align: 'right', cell: (p) => <span className="tabular text-muted-foreground">{formatINR(p.financialSummary?.pending)}</span>, hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every installation from order to closure."
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={(v) => setParams({ view: v === 'list' ? null : v })}
              options={[
                { value: 'list', label: 'List', icon: <List /> },
                { value: 'board', label: 'Phase board', icon: <Columns3 /> },
              ]}
            />
            {canCreate && (
              <ButtonLink href="/projects/new">
                <Plus /> New project
              </ButtonLink>
            )}
          </>
        }
      />

      {view === 'list' ? (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search code, customer or phone…" />
            <Select
              aria-label="Phase"
              className="sm:w-52"
              value={filters.phase}
              onChange={(e) => setParams({ phase: e.target.value, page: null })}
              placeholder="All phases"
              options={PHASES.map((p) => ({ value: p.key, label: `${p.order}. ${p.name}` }))}
            />
            <Select
              aria-label="Status"
              className="sm:w-44"
              value={filters.status}
              onChange={(e) => setParams({ status: e.target.value, page: null })}
              placeholder="All statuses"
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
          </div>
          <DataTable
            caption="Projects"
            columns={columns}
            data={list.data?.data}
            rowKey={(p) => p.id}
            loading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            meta={list.data?.meta}
            onPageChange={(page) => setParams({ page: String(page) })}
            sort={filters.sort ? { id: filters.sort.replace(/^-/, ''), desc: filters.sort.startsWith('-') } : null}
            onSortChange={(s) => setParams({ sort: s ? `${s.desc ? '-' : ''}${s.id}` : null, page: null })}
            onRowClick={(p) => router.push(`/projects/${p.id}`)}
            empty={
              <EmptyState
                icon={FolderKanban}
                title={filters.q || filters.phase || filters.status ? 'No matching projects' : 'No projects yet'}
                description={filters.q || filters.phase || filters.status ? 'Try clearing the filters.' : 'Convert a won lead or create a project to start the workflow.'}
                action={canCreate && !filters.q && <ButtonLink href="/projects/new">New project</ButtonLink>}
              />
            }
          />
        </>
      ) : board.error ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : (
        <KanbanBoard
          loading={board.isLoading}
          columns={PHASES.map((p) => {
            const items = board.data?.[p.key] ?? [];
            return { key: p.key, title: p.name, tone: p.color, items, summary: items.length ? formatINR(items.reduce((s, x) => s + x.contractValue, 0)) : undefined };
          })}
          itemKey={(p) => p.id}
          renderCard={(p) => <ProjectBoardCard project={p} />}
          emptyLabel="No projects in this phase"
        />
      )}
    </>
  );
}
