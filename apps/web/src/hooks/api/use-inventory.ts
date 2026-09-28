'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { dispatchSchema, dispatchStatusSchema, ItemInput, stockMovementSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Dispatch, InventoryItem, InventorySummary, ListParams, StockMovement } from '@/lib/types';

export function useItems(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.inventory.items(params), queryFn: () => api.list<InventoryItem>('/inventory/items', params), placeholderData: keepPreviousData, enabled });
}

export function useSaveItem(id?: string) {
  return useMutation({
    mutationFn: (body: ItemInput) => (id ? api.patch<InventoryItem>(`/inventory/items/${id}`, body) : api.post<InventoryItem>('/inventory/items', body)),
    meta: { successMessage: id ? 'Item updated' : 'Item added', invalidates: [qk.inventory.all] },
  });
}

export function useArchiveItem() {
  return useMutation({ mutationFn: (id: string) => api.delete(`/inventory/items/${id}`), meta: { successMessage: 'Item archived', invalidates: [qk.inventory.all] } });
}

export function useMovements(params: ListParams) {
  return useQuery({ queryKey: qk.inventory.movements(params), queryFn: () => api.list<StockMovement>('/inventory/movements', params), placeholderData: keepPreviousData });
}

export function useCreateMovement() {
  return useMutation({
    mutationFn: (body: z.output<typeof stockMovementSchema>) => api.post<StockMovement>('/inventory/movements', body),
    meta: { successMessage: 'Stock updated', invalidates: [qk.inventory.all] },
  });
}

export function useInventorySummary() {
  return useQuery({ queryKey: qk.inventory.summary(), queryFn: () => api.get<InventorySummary>('/inventory/summary') });
}

export function useDispatches(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.dispatches.list(params), queryFn: () => api.list<Dispatch>('/dispatches', params), placeholderData: keepPreviousData, enabled });
}

export function useCreateDispatch() {
  return useMutation({
    mutationFn: (body: z.output<typeof dispatchSchema>) => api.post<Dispatch>('/dispatches', body),
    meta: { successMessage: 'Dispatch planned', invalidates: [qk.dispatches.all, qk.inventory.all] },
  });
}

export function useDispatchStatus(id: string) {
  return useMutation({
    mutationFn: (body: z.input<typeof dispatchStatusSchema>) => api.post<Dispatch>(`/dispatches/${id}/status`, body),
    meta: { successMessage: 'Dispatch updated', invalidates: [qk.dispatches.all, qk.inventory.all, qk.projects.all] },
  });
}
