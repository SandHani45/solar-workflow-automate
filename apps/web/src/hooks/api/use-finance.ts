'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { advanceSchema, expenseDecisionSchema, ExpenseInput, Partner, PaymentInput } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Advance, Expense, FinanceDashboard, ListParams, Payment } from '@/lib/types';

export function useFinanceDashboard(params: ListParams) {
  return useQuery({ queryKey: qk.finance.dashboard(params), queryFn: () => api.get<FinanceDashboard>('/finance/dashboard', params), placeholderData: keepPreviousData });
}

export function usePayments(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.finance.payments(params), queryFn: () => api.list<Payment>('/payments', params), placeholderData: keepPreviousData, enabled });
}

export function useRecordPayment() {
  return useMutation({
    mutationFn: (body: PaymentInput) => api.post<Payment>('/payments', body),
    meta: { successMessage: 'Payment recorded', invalidates: [qk.finance.all, qk.projects.all, qk.dashboard] },
  });
}

export function useDeletePayment() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    meta: { successMessage: 'Payment removed', invalidates: [qk.finance.all, qk.projects.all] },
  });
}

export function useExpenses(params: ListParams, enabled = true) {
  return useQuery({ queryKey: qk.finance.expenses(params), queryFn: () => api.list<Expense>('/expenses', params), placeholderData: keepPreviousData, enabled });
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: (body: ExpenseInput) => api.post<Expense>('/expenses', body),
    meta: { successMessage: 'Expense submitted', invalidates: [qk.finance.all, qk.projects.all] },
  });
}

export function useDecideExpense() {
  return useMutation({
    mutationFn: ({ id, ...body }: z.input<typeof expenseDecisionSchema> & { id: string }) => api.post<Expense>(`/expenses/${id}/decision`, body),
    meta: { invalidates: [qk.finance.all, qk.projects.all] },
  });
}

export function useDeleteExpense() {
  return useMutation({ mutationFn: (id: string) => api.delete(`/expenses/${id}`), meta: { successMessage: 'Expense deleted', invalidates: [qk.finance.all] } });
}

export function useAdvances(enabled = true) {
  return useQuery({ queryKey: qk.finance.advances(), queryFn: () => api.list<Advance>('/advances', { limit: 100 }), enabled });
}

export function useCreateAdvance() {
  return useMutation({
    mutationFn: (body: z.output<typeof advanceSchema>) => api.post<Advance>('/advances', body),
    meta: { successMessage: 'Advance recorded', invalidates: [qk.finance.all] },
  });
}

export function useSettleAdvance() {
  return useMutation({ mutationFn: (id: string) => api.post<Advance>(`/advances/${id}/settle`), meta: { successMessage: 'Advance settled', invalidates: [qk.finance.all] } });
}

export function usePartners(enabled = true) {
  return useQuery({ queryKey: qk.org.partners(), queryFn: () => api.get<{ partners: Partner[] } | Partner[]>('/org/partners'), enabled, select: (d) => (Array.isArray(d) ? d : d.partners) });
}

export function useSavePartners() {
  return useMutation({
    mutationFn: (partners: Partner[]) => api.put('/org/partners', { partners }),
    meta: { successMessage: 'Partners saved', invalidates: [qk.org.all, qk.finance.all] },
  });
}
