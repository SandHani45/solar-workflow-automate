'use client';

import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from '@solar/shared';
import { useDocuments } from '@/hooks/api/use-documents';
import { useQueryParams } from '@/hooks/use-query-state';
import type { ProjectDocument } from '@/lib/types';
import { formatBytes, formatDate } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { DocumentLink } from '@/components/documents/document-link';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';

export default function DocumentsPage() {
  return (
    <Require permission="documents:read">
      <Documents />
    </Require>
  );
}

function Documents() {
  const [params, setParams] = useQueryParams();
  const filters = { projectId: params.get('projectId') ?? '', type: params.get('type') ?? '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = useDocuments({ ...filters, limit: 25, sort: '-createdAt' });

  const columns: Column<ProjectDocument>[] = [
    { id: 'name', header: 'File', cell: (d) => <DocumentLink doc={d} className="max-w-72 text-sm" /> },
    { id: 'type', header: 'Type', cell: (d) => <Badge tone="blue">{DOCUMENT_TYPE_LABELS[d.type] ?? d.type}</Badge> },
    {
      id: 'project',
      header: 'Project',
      cell: (d) =>
        d.projectId ? (
          <Link href={`/projects/${d.projectId}?tab=documents`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline dark:text-blue-400">
            Open project
          </Link>
        ) : (
          '—'
        ),
      hideOnMobile: true,
    },
    { id: 'size', header: 'Size', cell: (d) => formatBytes(d.size), sortValue: (d) => d.size, hideOnMobile: true },
    { id: 'by', header: 'Uploaded by', cell: (d) => d.uploadedBy?.name ?? '—', hideOnMobile: true },
    { id: 'createdAt', header: 'Date', cell: (d) => formatDate(d.createdAt), sortValue: (d) => d.createdAt },
    {
      id: 'dl',
      header: <span className="sr-only">Download</span>,
      align: 'right',
      cell: (d) => (
        <a href={d.url} download aria-label={`Download ${d.originalName}`} className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Download className="size-4" />
        </a>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Documents" description="KYC, agreements, certificates, bills and site photos across all projects." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <ProjectPicker value={filters.projectId} onChange={(p) => setParams({ projectId: p.id, page: null })} />
        </div>
        <Select aria-label="Document type" className="sm:w-56" placeholder="All types" value={filters.type} onChange={(e) => setParams({ type: e.target.value, page: null })} options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))} />
        {(filters.projectId || filters.type) && (
          <Button variant="ghost" size="sm" onClick={() => setParams({ projectId: null, type: null, page: null })}>
            Clear filters
          </Button>
        )}
      </div>
      <DataTable
        caption="Documents"
        columns={columns}
        data={data?.data}
        rowKey={(d) => d.id}
        loading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={(p) => setParams({ page: String(p) })}
        empty={<EmptyState icon={FileText} title="No documents" description="Upload documents from a project's workflow stages or Documents tab." />}
      />
    </>
  );
}
