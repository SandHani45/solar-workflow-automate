/**
 * Permission catalogue. Every protected API route and every gated UI element
 * checks one of these keys. Roles are just named bundles of permissions, so an
 * org admin can build any custom role from this list.
 */
export const PERMISSION_GROUPS = {
  dashboard: ['dashboard:read'],
  leads: ['leads:read', 'leads:write', 'leads:delete', 'leads:assign'],
  projects: ['projects:read', 'projects:read_all', 'projects:write', 'projects:delete', 'projects:assign'],
  workflow: ['workflow:advance', 'workflow:override', 'workflow:manage'],
  quotations: ['quotations:read', 'quotations:write', 'quotations:approve'],
  documents: ['documents:read', 'documents:write', 'documents:delete'],
  inventory: ['inventory:read', 'inventory:write', 'inventory:adjust'],
  dispatch: ['dispatch:read', 'dispatch:write'],
  payments: ['payments:read', 'payments:write'],
  expenses: ['expenses:read', 'expenses:write', 'expenses:approve'],
  finance: ['finance:read', 'finance:partners'],
  tickets: ['tickets:read', 'tickets:write', 'tickets:assign'],
  users: ['users:read', 'users:manage'],
  roles: ['roles:manage'],
  settings: ['settings:manage', 'features:manage'],
  audit: ['audit:read'],
  reports: ['reports:read', 'reports:export'],
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;
export type Permission = (typeof PERMISSION_GROUPS)[PermissionGroup][number];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_GROUPS).flat() as Permission[];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:read': 'View dashboard',
  'leads:read': 'View leads',
  'leads:write': 'Create & edit leads',
  'leads:delete': 'Delete leads',
  'leads:assign': 'Assign leads',
  'projects:read': 'View assigned projects',
  'projects:read_all': 'View all projects',
  'projects:write': 'Create & edit projects',
  'projects:delete': 'Delete projects',
  'projects:assign': 'Assign project team',
  'workflow:advance': 'Complete workflow stages',
  'workflow:override': 'Override stage rules / reopen stages',
  'workflow:manage': 'Customise workflow template',
  'quotations:read': 'View quotations',
  'quotations:write': 'Create & edit quotations',
  'quotations:approve': 'Approve quotations',
  'documents:read': 'View documents',
  'documents:write': 'Upload documents',
  'documents:delete': 'Delete documents',
  'inventory:read': 'View warehouse stock',
  'inventory:write': 'Manage items & stock-in',
  'inventory:adjust': 'Adjust stock',
  'dispatch:read': 'View dispatches',
  'dispatch:write': 'Plan & update dispatches',
  'payments:read': 'View payments',
  'payments:write': 'Record payments',
  'expenses:read': 'View expenses',
  'expenses:write': 'Record expenses',
  'expenses:approve': 'Approve expenses',
  'finance:read': 'View finance dashboard',
  'finance:partners': 'Manage partners & profit split',
  'tickets:read': 'View service tickets',
  'tickets:write': 'Create & update tickets',
  'tickets:assign': 'Assign tickets',
  'users:read': 'View team',
  'users:manage': 'Invite & manage users',
  'roles:manage': 'Manage roles & permissions',
  'settings:manage': 'Manage organisation settings',
  'features:manage': 'Enable features per role',
  'audit:read': 'View audit log',
  'reports:read': 'View reports',
  'reports:export': 'Export reports',
};

export function hasPermission(granted: readonly string[] | undefined, required: Permission | Permission[]): boolean {
  if (!granted) return false;
  const req = Array.isArray(required) ? required : [required];
  return req.every((p) => granted.includes(p));
}

export function hasAnyPermission(granted: readonly string[] | undefined, required: Permission[]): boolean {
  if (!granted) return false;
  return required.some((p) => granted.includes(p));
}
