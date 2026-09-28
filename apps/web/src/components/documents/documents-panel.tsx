'use client';

import { Download, FileText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentType } from '@solar/shared';
import { isImage, useDeleteDocument, useUploadDocument } from '@/hooks/api/use-documents';
import { useCan } from '@/hooks/use-session';
import type { ProjectDocument } from '@/lib/types';
import { formatBytes, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FileUpload } from '@/components/ui/file-upload';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

/** Project documents grouped by type, with image thumbnails, upload and delete. */
export function DocumentsPanel({ projectId, documents, loading }: { projectId: string; documents: ProjectDocument[]; loading?: boolean }) {
  const canWrite = useCan({ permission: 'documents:write' });
  const canDelete = useCan({ permission: 'documents:delete' });
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const [type, setType] = useState<DocumentType>('site_photo');
  const [toDelete, setToDelete] = useState<ProjectDocument | null>(null);

  const groups = useMemo(() => {
    const m = new Map<DocumentType, ProjectDocument[]>();
    for (const d of documents) m.set(d.type, [...(m.get(d.type) ?? []), d]);
    return DOCUMENT_TYPES.filter((t) => m.has(t)).map((t) => ({ type: t, docs: m.get(t) ?? [] }));
  }, [documents]);

  return (
    <div className="space-y-5">
      {canWrite && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr] sm:items-start">
            <FormField label="Document type">
              <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))} />
            </FormField>
            <FileUpload onUpload={(file, onProgress) => upload.mutateAsync({ file, type, projectId, onProgress })} label={`Upload ${DOCUMENT_TYPE_LABELS[type]}`} />
          </div>
        </Card>
      )}
      {loading && <Skeleton className="h-48 rounded-xl" />}
      {!loading && groups.length === 0 && <EmptyState icon={FileText} title="No documents yet" description="KYC, agreements, certificates and site photos uploaded to this project appear here." />}
      {groups.map(({ type: t, docs }) => (
        <section key={t} aria-labelledby={`doc-${t}`}>
          <h3 id={`doc-${t}`} className="mb-2 text-sm font-semibold">
            {DOCUMENT_TYPE_LABELS[t]} <span className="font-normal text-muted-foreground">({docs.length})</span>
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {docs.map((d) => (
              <li key={d.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                <a href={d.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-muted">
                  {isImage(d) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated API file URL
                    <img src={d.url} alt={d.originalName} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <FileText className="size-8" aria-hidden />
                      <span className="text-[10px] uppercase">{d.mimeType.split('/')[1]}</span>
                    </span>
                  )}
                </a>
                <div className="flex items-start gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" title={d.originalName}>
                      {d.originalName}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {formatBytes(d.size)} · {formatDate(d.createdAt, 'd MMM')} · {d.uploadedBy?.name}
                    </p>
                  </div>
                  <a href={d.url} download className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Download ${d.originalName}`}>
                    <Download className="size-3.5" />
                  </a>
                  {canDelete && (
                    <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => setToDelete(d)} aria-label={`Delete ${d.originalName}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete document?"
        description={toDelete?.originalName}
        destructive
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}
