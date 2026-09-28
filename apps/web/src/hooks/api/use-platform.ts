'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { platformOrgUpdateSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ListParams, PlatformFeature, PlatformOrg, PlatformStats } from '@/lib/types';

export function usePlatformStats() {
  return useQuery({ queryKey: qk.platform.stats(), queryFn: () => api.get<PlatformStats>('/platform/stats') });
}

export function usePlatformOrgs(params: ListParams) {
  return useQuery({ queryKey: qk.platform.orgs(params), queryFn: () => api.list<PlatformOrg>('/platform/orgs', params), placeholderData: keepPreviousData });
}

export function usePlatformOrg(id: string) {
  return useQuery({ queryKey: qk.platform.org(id), queryFn: () => api.get<PlatformOrg>(`/platform/orgs/${id}`) });
}

export function useUpdatePlatformOrg(id: string) {
  return useMutation({
    mutationFn: (body: z.input<typeof platformOrgUpdateSchema>) => api.patch<PlatformOrg>(`/platform/orgs/${id}`, body),
    meta: { successMessage: 'Tenant updated', invalidates: [qk.platform.all] },
  });
}

export function usePlatformFeatures() {
  return useQuery({ queryKey: qk.platform.features(), queryFn: () => api.get<PlatformFeature[]>('/platform/features') });
}

export function useUpdatePlatformFeature() {
  return useMutation({
    mutationFn: ({ key, ...body }: { key: string; name?: string; description?: string; defaultEnabled?: boolean }) => api.patch<PlatformFeature>(`/platform/features/${key}`, body),
    meta: { successMessage: 'Feature catalogue updated', invalidates: [qk.platform.features()] },
  });
}
