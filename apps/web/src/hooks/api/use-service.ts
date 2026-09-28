'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { amcSchema, TicketInput, ticketUpdateSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { AmcContract, ListParams, Ticket } from '@/lib/types';

export function useTickets(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.tickets.list(params), queryFn: () => api.list<Ticket>('/tickets', params), placeholderData: keepPreviousData, enabled });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: qk.tickets.detail(id), queryFn: () => api.get<Ticket>(`/tickets/${id}`), enabled: !!id });
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: (body: TicketInput) => api.post<Ticket>('/tickets', body),
    meta: { successMessage: 'Ticket raised', invalidates: [qk.tickets.all, qk.dashboard] },
  });
}

export function useUpdateTicket(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof ticketUpdateSchema>) => api.patch<Ticket>(`/tickets/${id}`, body),
    onSuccess: (t) => client.setQueryData(qk.tickets.detail(id), (old: Ticket | undefined) => ({ ...t, comments: t.comments ?? old?.comments })),
    meta: { successMessage: 'Ticket updated', invalidates: [qk.tickets.all, qk.dashboard] },
  });
}

export function useTicketComment(id: string) {
  return useMutation({
    mutationFn: (body: string) => api.post(`/tickets/${id}/comments`, { body }),
    meta: { invalidates: [qk.tickets.detail(id)] },
  });
}

export function useAmcContracts(params: ListParams) {
  return useQuery({ queryKey: qk.amc.list(params), queryFn: () => api.list<AmcContract>('/amc', params), placeholderData: keepPreviousData });
}

export function useCreateAmc() {
  return useMutation({
    mutationFn: (body: z.output<typeof amcSchema>) => api.post<AmcContract>('/amc', body),
    meta: { successMessage: 'AMC contract created', invalidates: [qk.amc.all] },
  });
}

export function useAmcVisit() {
  return useMutation({
    mutationFn: ({ amcId, visitId, done, note }: { amcId: string; visitId: string; done: boolean; note?: string }) => api.patch(`/amc/${amcId}/visits/${visitId}`, { done, note }),
    meta: { successMessage: 'Visit updated', invalidates: [qk.amc.all] },
  });
}
