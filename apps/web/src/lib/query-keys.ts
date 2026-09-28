import type { ListParams } from './types';

/**
 * Query key factory. Every key starts with its resource so `invalidateQueries({ queryKey: qk.projects.all })`
 * refreshes lists, boards and details together.
 */
export const qk = {
  session: ['session'] as const,
  org: {
    all: ['org'] as const,
    detail: () => ['org', 'detail'] as const,
    features: () => ['org', 'features'] as const,
    workflow: () => ['org', 'workflow'] as const,
    partners: () => ['org', 'partners'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (p?: ListParams) => ['users', 'list', p ?? {}] as const,
    options: (role?: string) => ['users', 'options', role ?? 'all'] as const,
  },
  roles: { all: ['roles'] as const },
  permissions: ['permissions'] as const,
  dashboard: ['dashboard'] as const,
  leads: {
    all: ['leads'] as const,
    list: (p?: ListParams) => ['leads', 'list', p ?? {}] as const,
    board: () => ['leads', 'board'] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (p?: ListParams) => ['projects', 'list', p ?? {}] as const,
    board: () => ['projects', 'board'] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    comments: (id: string) => ['projects', 'comments', id] as const,
    timeline: (id: string) => ['projects', 'timeline', id] as const,
    financials: (id: string) => ['projects', 'financials', id] as const,
  },
  quotations: {
    all: ['quotations'] as const,
    list: (p?: ListParams) => ['quotations', 'list', p ?? {}] as const,
    detail: (id: string) => ['quotations', 'detail', id] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (p?: ListParams) => ['documents', 'list', p ?? {}] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    items: (p?: ListParams) => ['inventory', 'items', p ?? {}] as const,
    movements: (p?: ListParams) => ['inventory', 'movements', p ?? {}] as const,
    summary: () => ['inventory', 'summary'] as const,
  },
  dispatches: {
    all: ['dispatches'] as const,
    list: (p?: ListParams) => ['dispatches', 'list', p ?? {}] as const,
    detail: (id: string) => ['dispatches', 'detail', id] as const,
  },
  finance: {
    all: ['finance'] as const,
    dashboard: (p?: ListParams) => ['finance', 'dashboard', p ?? {}] as const,
    payments: (p?: ListParams) => ['finance', 'payments', p ?? {}] as const,
    expenses: (p?: ListParams) => ['finance', 'expenses', p ?? {}] as const,
    advances: () => ['finance', 'advances'] as const,
  },
  tickets: {
    all: ['tickets'] as const,
    list: (p?: ListParams) => ['tickets', 'list', p ?? {}] as const,
    detail: (id: string) => ['tickets', 'detail', id] as const,
  },
  amc: { all: ['amc'] as const, list: (p?: ListParams) => ['amc', 'list', p ?? {}] as const },
  notifications: { all: ['notifications'] as const, list: (p?: ListParams) => ['notifications', 'list', p ?? {}] as const },
  audit: { list: (p?: ListParams) => ['audit', p ?? {}] as const },
  search: (q: string) => ['search', q] as const,
  platform: {
    all: ['platform'] as const,
    stats: () => ['platform', 'stats'] as const,
    orgs: (p?: ListParams) => ['platform', 'orgs', p ?? {}] as const,
    org: (id: string) => ['platform', 'org', id] as const,
    features: () => ['platform', 'features'] as const,
  },
};
