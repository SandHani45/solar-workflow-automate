'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { DocumentType } from '@solar/shared';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ListParams, ProjectDocument } from '@/lib/types';

export function useDocuments(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: qk.documents.list(params),
    queryFn: () => api.list<ProjectDocument>('/documents', { limit: 100, ...params }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export interface UploadDocumentInput {
  file: File;
  type: DocumentType;
  projectId?: string;
  leadId?: string;
  ticketId?: string;
  expenseId?: string;
  stageKey?: string;
  note?: string;
  onProgress?: (pct: number) => void;
}

export function useUploadDocument() {
  return useMutation({
    mutationFn: ({ file, onProgress, ...meta }: UploadDocumentInput) => {
      const form = new FormData();
      form.append('file', file);
      for (const [k, v] of Object.entries(meta)) if (v) form.append(k, v);
      return api.upload<ProjectDocument>('/documents', form, onProgress);
    },
    // FileUpload shows per-file errors inline.
    meta: { skipErrorToast: true, successMessage: 'Uploaded', invalidates: [qk.documents.all, qk.projects.all] },
  });
}

export function useDeleteDocument() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    meta: { successMessage: 'Document deleted', invalidates: [qk.documents.all, qk.projects.all] },
  });
}

export function isImage(doc: Pick<ProjectDocument, 'mimeType'>): boolean {
  return doc.mimeType.startsWith('image/') && !doc.mimeType.includes('heic') && !doc.mimeType.includes('heif');
}
