import { DEFAULT_ROLES, humanize } from '@solar/shared';

const NAMES = new Map(DEFAULT_ROLES.map((r) => [r.key, r.name]));
const SHORT: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
  operations: 'Operations',
  warehouse: 'Warehouse',
  engineer: 'Engineer',
  accounts: 'Accounts',
  service: 'Service',
  customer: 'Customer',
};

/** Display name for a role key (default roles; custom roles fall back to a humanized key). */
export function roleName(key: string): string {
  return NAMES.get(key) ?? humanize(key);
}

/** Compact label for chips on cards. */
export function roleShort(key: string): string {
  return SHORT[key] ?? humanize(key);
}
