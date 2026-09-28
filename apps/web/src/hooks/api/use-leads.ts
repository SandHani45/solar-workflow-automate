'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeadStatus, leadActivitySchema, leadSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Lead, LeadBoard, ListParams, Project } from '@/lib/types';

type LeadBody = z.input<typeof leadSchema>;

export function useLeads(params: ListParams) {
  return useQuery({ queryKey: qk.leads.list(params), queryFn: () => api.list<Lead>('/leads', params), placeholderData: keepPreviousData });
}

export function useLeadBoard(enabled = true) {
  return useQuery({ queryKey: qk.leads.board(), queryFn: () => api.get<LeadBoard>('/leads/board'), enabled });
}

export function useLead(id: string) {
  return useQuery({ queryKey: qk.leads.detail(id), queryFn: () => api.get<Lead>(`/leads/${id}`), enabled: !!id });
}

export function useCreateLead() {
  return useMutation({
    mutationFn: (body: LeadBody) => api.post<Lead>('/leads', body),
    meta: { successMessage: 'Lead created', invalidates: [qk.leads.all, qk.dashboard] },
  });
}

export function useUpdateLead(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<LeadBody>) => api.patch<Lead>(`/leads/${id}`, body),
    onSuccess: (lead) => client.setQueryData(qk.leads.detail(id), lead),
    meta: { successMessage: 'Lead updated', invalidates: [qk.leads.all] },
  });
}

/** Kanban drag: moves the card immediately, rolls back if the API refuses. */
export function useMoveLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, to }: { lead: Lead; to: LeadStatus }) => api.patch<Lead>(`/leads/${lead.id}`, { status: to }),
    onMutate: async ({ lead, to }) => {
      await client.cancelQueries({ queryKey: qk.leads.board() });
      const previous = client.getQueryData<LeadBoard>(qk.leads.board());
      if (previous) {
        const next: LeadBoard = {};
        for (const [status, leads] of Object.entries(previous) as [LeadStatus, Lead[]][]) next[status] = leads.filter((l) => l.id !== lead.id);
        next[to] = [{ ...lead, status: to }, ...(next[to] ?? [])];
        client.setQueryData(qk.leads.board(), next);
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) client.setQueryData(qk.leads.board(), ctx.previous);
    },
    meta: { invalidates: [qk.leads.all] },
  });
}

export function useDeleteLead() {
  return useMutation({ mutationFn: (id: string) => api.delete(`/leads/${id}`), meta: { successMessage: 'Lead deleted', invalidates: [qk.leads.all] } });
}

export function useAddLeadActivity(id: string) {
  return useMutation({
    mutationFn: (body: z.input<typeof leadActivitySchema>) => api.post(`/leads/${id}/activities`, body),
    meta: { successMessage: 'Activity logged', invalidates: [qk.leads.detail(id)] },
  });
}

export function useConvertLead(id: string) {
  return useMutation({
    mutationFn: (body: { systemSizeKw: number; contractValue?: number }) => api.post<Project>(`/leads/${id}/convert`, body),
    meta: { successMessage: 'Lead converted to project', invalidates: [qk.leads.all, qk.projects.all, qk.dashboard] },
  });
}
