import { ALL_PERMISSIONS, type Permission } from './permissions';

/**
 * Default roles seeded into every new organisation. They are editable
 * (except `owner`, which always has every permission) and admins can add
 * custom roles on top.
 *
 * Platform-level `super_admin` is NOT an org role — it is a flag on the user
 * (`isSuperAdmin`) that grants access to /platform routes (tenants, feature
 * catalogue, plans).
 */
export const SYSTEM_ROLE_KEYS = [
  'owner',
  'admin',
  'manager',
  'sales',
  'operations',
  'warehouse',
  'engineer',
  'accounts',
  'service',
  'customer',
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

const without = (...exclude: Permission[]) => ALL_PERMISSIONS.filter((p) => !exclude.includes(p));

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner / Partner',
    description: 'Business owner. Full access including finance, partners and profit split.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Runs the organisation: users, roles, workflow and settings.',
    permissions: without('finance:partners'),
    isSystem: true,
  },
  {
    key: 'manager',
    name: 'Project Manager',
    description: 'Oversees all projects and teams across every phase.',
    permissions: [
      'dashboard:read', 'leads:read', 'leads:write', 'leads:assign',
      'projects:read', 'projects:read_all', 'projects:write', 'projects:assign',
      'workflow:advance', 'workflow:override',
      'quotations:read', 'quotations:write', 'quotations:approve',
      'documents:read', 'documents:write',
      'inventory:read', 'dispatch:read', 'dispatch:write',
      'payments:read', 'expenses:read', 'expenses:write', 'expenses:approve',
      'tickets:read', 'tickets:write', 'tickets:assign',
      'users:read', 'reports:read', 'reports:export', 'audit:read',
    ],
    isSystem: true,
  },
  {
    key: 'sales',
    name: 'Sales Executive',
    description: 'Phase 1: leads, site survey, quotations and closing orders.',
    permissions: [
      'dashboard:read', 'leads:read', 'leads:write',
      'projects:read', 'projects:write', 'workflow:advance',
      'quotations:read', 'quotations:write',
      'documents:read', 'documents:write', 'payments:read',
    ],
    isSystem: true,
  },
  {
    key: 'operations',
    name: 'Operations / Documentation',
    description: 'Phase 2 & 6: customer documents, BOQ, subsidy, loan, net-metering.',
    permissions: [
      'dashboard:read', 'projects:read', 'projects:read_all', 'projects:write', 'workflow:advance',
      'quotations:read', 'documents:read', 'documents:write',
      'inventory:read', 'dispatch:read', 'payments:read', 'tickets:read',
    ],
    isSystem: true,
  },
  {
    key: 'warehouse',
    name: 'Warehouse / Logistics',
    description: 'Phase 3: stock, material checking, dispatch and unloading.',
    permissions: [
      'dashboard:read', 'projects:read', 'projects:read_all', 'workflow:advance',
      'documents:read', 'documents:write',
      'inventory:read', 'inventory:write', 'inventory:adjust',
      'dispatch:read', 'dispatch:write',
    ],
    isSystem: true,
  },
  {
    key: 'engineer',
    name: 'Project Engineer / Site Team',
    description: 'Phase 4: installation, site photos, meter fixing and client training.',
    permissions: [
      'dashboard:read', 'projects:read', 'workflow:advance',
      'documents:read', 'documents:write', 'inventory:read', 'dispatch:read',
      'expenses:read', 'expenses:write', 'tickets:read', 'tickets:write',
    ],
    isSystem: true,
  },
  {
    key: 'accounts',
    name: 'Accounts',
    description: 'Payments, expenses, bills and the finance dashboard.',
    permissions: [
      'dashboard:read', 'projects:read', 'projects:read_all',
      'quotations:read', 'documents:read', 'documents:write',
      'inventory:read', 'payments:read', 'payments:write',
      'expenses:read', 'expenses:write', 'expenses:approve',
      'finance:read', 'reports:read', 'reports:export',
    ],
    isSystem: true,
  },
  {
    key: 'service',
    name: 'Service Technician',
    description: 'Phase 7: service tickets, AMC visits and issue resolution.',
    permissions: [
      'dashboard:read', 'projects:read', 'projects:read_all',
      'documents:read', 'documents:write', 'tickets:read', 'tickets:write',
    ],
    isSystem: true,
  },
  {
    key: 'customer',
    name: 'Customer (Portal)',
    description: 'End customer: tracks own project, documents, payments and raises tickets.',
    permissions: ['projects:read', 'documents:read', 'payments:read', 'tickets:read', 'tickets:write'],
    isSystem: true,
  },
];
