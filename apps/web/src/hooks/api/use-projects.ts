'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { boqSchema, ProjectInput, projectUpdateSchema, StageUpdateInput } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { AuditEntry, ListParams, Project, ProjectBoard, ProjectComment, ProjectFinancials, User } from '@/lib/types';

export function useProjects(params: ListParams) {
  return useQuery({ queryKey: qk.projects.list(params), queryFn: () => api.list<Project>('/projects', params), placeholderData: keepPreviousData });
}

export function useProjectBoard(enabled = true) {
  return useQuery({ queryKey: qk.projects.board(), queryFn: () => api.get<ProjectBoard>('/projects/board'), enabled });
}

export function useProject(id: string) {
  return useQuery({ queryKey: qk.projects.detail(id), queryFn: () => api.get<Project>(`/projects/${id}`), enabled: !!id });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: (body: ProjectInput) => api.post<Project>('/projects', body),
    meta: { successMessage: 'Project created', invalidates: [qk.projects.all, qk.dashboard] },
  });
}

export function useUpdateProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof projectUpdateSchema>) => api.patch<Project>(`/projects/${id}`, body),
    onSuccess: (p) => client.setQueryData(qk.projects.detail(id), p),
    meta: { successMessage: 'Project updated', invalidates: [qk.projects.all] },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    meta: { successMessage: 'Project deleted', invalidates: [qk.projects.all, qk.dashboard] },
  });
}

/**
 * Stage update. Applies checklist/status optimistically so ticking items on a phone feels instant;
 * rolls back on error. STAGE_RULE errors are rendered by the drawer, so no generic toast.
 */
export function useUpdateStage(projectId: string) {
  const client = useQueryClient();
  const key = qk.projects.detail(projectId);
  return useMutation({
    mutationFn: ({ stageKey, body }: { stageKey: string; body: StageUpdateInput }) => api.patch<Project>(`/projects/${projectId}/stages/${stageKey}`, body),
    onMutate: async ({ stageKey, body }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Project>(key);
      if (previous && (body.checklist || body.data)) {
        client.setQueryData<Project>(key, {
          ...previous,
          stages: previous.stages.map((s) =>
            s.key === stageKey ? { ...s, checklist: body.checklist ?? s.checklist, data: body.data ? { ...s.data, ...body.data } : s.data } : s,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) client.setQueryData(key, ctx.previous);
    },
    onSuccess: (project) => client.setQueryData(key, project),
    meta: { skipErrorToast: true, invalidates: [qk.projects.board(), qk.projects.timeline(projectId), qk.dashboard, qk.projects.financials(projectId)] },
  });
}

export function useReopenStage(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (stageKey: string) => api.post<Project>(`/projects/${projectId}/stages/${stageKey}/reopen`),
    onSuccess: (project) => client.setQueryData(qk.projects.detail(projectId), project),
    meta: { successMessage: 'Stage reopened', invalidates: [qk.projects.board(), qk.projects.timeline(projectId), qk.dashboard] },
  });
}

export function useSaveBoq(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof boqSchema>) => api.put<Project>(`/projects/${projectId}/boq`, body),
    onSuccess: (project) => client.setQueryData(qk.projects.detail(projectId), project),
    meta: { successMessage: 'BOQ saved' },
  });
}

export function useProjectComments(projectId: string) {
  return useQuery({ queryKey: qk.projects.comments(projectId), queryFn: () => api.get<ProjectComment[]>(`/projects/${projectId}/comments`) });
}

export function useAddComment(projectId: string) {
  return useMutation({
    mutationFn: (body: string) => api.post<ProjectComment>(`/projects/${projectId}/comments`, { body }),
    meta: { invalidates: [qk.projects.comments(projectId)] },
  });
}

export function useProjectTimeline(projectId: string) {
  return useQuery({ queryKey: qk.projects.timeline(projectId), queryFn: () => api.get<AuditEntry[]>(`/projects/${projectId}/timeline`) });
}

export function useProjectFinancials(projectId: string, enabled = true) {
  return useQuery({ queryKey: qk.projects.financials(projectId), queryFn: () => api.get<ProjectFinancials>(`/projects/${projectId}/financials`), enabled });
}

export function useCustomerAccess(projectId: string) {
  return useMutation({
    mutationFn: () => api.post<{ user: User; inviteUrl?: string }>(`/projects/${projectId}/customer-access`),
    meta: { successMessage: 'Customer portal access created', invalidates: [qk.projects.detail(projectId)] },
  });
}
