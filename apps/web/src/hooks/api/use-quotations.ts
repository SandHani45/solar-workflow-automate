'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuotationInput } from '@solar/shared';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ListParams, Quotation } from '@/lib/types';

export function useQuotations(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.quotations.list(params), queryFn: () => api.list<Quotation>('/quotations', params), placeholderData: keepPreviousData, enabled });
}

export function useQuotation(id: string) {
  return useQuery({ queryKey: qk.quotations.detail(id), queryFn: () => api.get<Quotation>(`/quotations/${id}`), enabled: !!id });
}

export function useSaveQuotation(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: QuotationInput) => (id ? api.patch<Quotation>(`/quotations/${id}`, body) : api.post<Quotation>('/quotations', body)),
    onSuccess: (q) => client.setQueryData(qk.quotations.detail(q.id), q),
    meta: { successMessage: id ? 'Quotation updated' : 'Quotation created', invalidates: [qk.quotations.all] },
  });
}

export function useQuotationStatus(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: 'sent' | 'accepted' | 'rejected') => api.post<Quotation>(`/quotations/${id}/status`, { status }),
    onSuccess: (q) => client.setQueryData(qk.quotations.detail(id), q),
    meta: { successMessage: 'Quotation status updated', invalidates: [qk.quotations.all, qk.projects.all] },
  });
}
