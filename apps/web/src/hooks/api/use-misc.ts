'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { AppNotification, AuditEntry, Dashboard, ListParams, Paginated, SearchResults } from '@/lib/types';

export function useDashboard() {
  return useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<Dashboard>('/dashboard'), refetchInterval: 120_000 });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q),
    queryFn: ({ signal }) => api.get<SearchResults>('/search', { q }, { signal }),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useNotifications(params: ListParams = {}, enabled = true) {
  return useQuery({
    queryKey: qk.notifications.list(params),
    queryFn: () => api.list<AppNotification>('/notifications', { limit: 20, ...params }),
    refetchInterval: 60_000,
    enabled,
  });
}

/** Marks read optimistically across every cached notifications list. */
export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => (id === 'all' ? api.post('/notifications/read-all') : api.post(`/notifications/${id}/read`)),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.notifications.all });
      const now = new Date().toISOString();
      client.setQueriesData<Paginated<AppNotification>>({ queryKey: qk.notifications.all }, (old) => {
        if (!old) return old;
        const data = old.data.map((n) => (id === 'all' || n.id === id ? { ...n, readAt: n.readAt ?? now } : n));
        const unread = id === 'all' ? 0 : Math.max(0, (old.meta.unread ?? 1) - (old.data.some((n) => n.id === id && !n.readAt) ? 1 : 0));
        return { data, meta: { ...old.meta, unread } };
      });
    },
    meta: { skipErrorToast: true, invalidates: [qk.notifications.all] },
  });
}

export function useAudit(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.audit.list(params), queryFn: () => api.list<AuditEntry>('/audit', params), placeholderData: keepPreviousData, enabled });
}
