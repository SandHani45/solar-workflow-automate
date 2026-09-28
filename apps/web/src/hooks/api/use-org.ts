'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { orgFeatureUpdateSchema, orgSettingsSchema, StageDefinition } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Org, OrgFeature, Workflow } from '@/lib/types';

export function useOrg() {
  return useQuery({ queryKey: qk.org.detail(), queryFn: () => api.get<Org>('/org') });
}

export function useUpdateOrg() {
  return useMutation({
    mutationFn: (body: z.output<typeof orgSettingsSchema>) => api.patch<Org>('/org', body),
    meta: { successMessage: 'Organisation settings saved', invalidates: [qk.org.all, qk.session] },
  });
}

export function useOrgFeatures() {
  return useQuery({ queryKey: qk.org.features(), queryFn: () => api.get<OrgFeature[]>('/org/features') });
}

export function useUpdateOrgFeature() {
  return useMutation({
    mutationFn: (body: z.input<typeof orgFeatureUpdateSchema>) => api.put<OrgFeature[]>('/org/features', body),
    meta: { successMessage: 'Feature updated', invalidates: [qk.org.all, qk.session] },
  });
}

export function useWorkflow() {
  return useQuery({ queryKey: qk.org.workflow(), queryFn: () => api.get<Workflow>('/org/workflow'), staleTime: 5 * 60_000 });
}

export function useSaveWorkflow() {
  return useMutation({
    mutationFn: (stages: StageDefinition[]) => api.put<Workflow>('/org/workflow', { stages }),
    meta: { successMessage: 'Workflow saved — new projects will use this version', invalidates: [qk.org.workflow()] },
  });
}

export function useResetWorkflow() {
  return useMutation({
    mutationFn: () => api.post<Workflow>('/org/workflow/reset'),
    meta: { successMessage: 'Workflow reset to defaults', invalidates: [qk.org.workflow()] },
  });
}
