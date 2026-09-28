'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { InviteUserInput, RoleInput, updateUserSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ListParams, Role, User, UserOption } from '@/lib/types';

export function useUsers(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.users.list(params), queryFn: () => api.list<User>('/users', params), placeholderData: keepPreviousData, enabled });
}

/** Lightweight user picker source; `role` narrows to one role key. */
export function useUserOptions(role?: string, enabled = true) {
  return useQuery({
    queryKey: qk.users.options(role),
    queryFn: () => api.get<UserOption[]>('/users/options', role ? { role } : undefined),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useInviteUser() {
  return useMutation({
    mutationFn: (body: InviteUserInput) => api.post<{ user: User; inviteUrl?: string }>('/users', body),
    meta: { invalidates: [qk.users.all, qk.roles.all] },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: ({ id, ...body }: z.input<typeof updateUserSchema> & { id: string }) => api.patch<User>(`/users/${id}`, body),
    meta: { successMessage: 'User updated', invalidates: [qk.users.all, qk.roles.all] },
  });
}

export function useRoles() {
  return useQuery({ queryKey: qk.roles.all, queryFn: () => api.get<Role[]>('/roles'), staleTime: 5 * 60_000 });
}

export function useCreateRole() {
  return useMutation({
    mutationFn: (body: RoleInput) => api.post<Role>('/roles', body),
    meta: { successMessage: 'Role created', invalidates: [qk.roles.all] },
  });
}

export function useUpdateRole() {
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RoleInput> & { id: string }) => api.patch<Role>(`/roles/${id}`, body),
    meta: { invalidates: [qk.roles.all, qk.session] },
  });
}

export function useDeleteRole() {
  return useMutation({ mutationFn: (id: string) => api.delete(`/roles/${id}`), meta: { successMessage: 'Role deleted', invalidates: [qk.roles.all] } });
}
