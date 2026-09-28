/**
 * Feature flag catalogue.
 *
 * Resolution order (see `isFeatureEnabled`):
 *   1. Platform catalogue default (`defaultEnabled`) — managed by super admin.
 *   2. Organisation override (`org.features[key].enabled`) — super admin sets per tenant
 *      (e.g. by plan), org admin may disable but never enable a platform-locked feature.
 *   3. Role restriction (`org.features[key].roles`) — org admin limits a feature to
 *      specific roles. Empty/undefined = all roles.
 */
export const FEATURE_KEYS = [
  'leads_crm',
  'site_survey',
  'quotations',
  'subsidy_loan',
  'inventory',
  'dispatch',
  'net_metering',
  'expenses',
  'finance_dashboard',
  'partner_profit_split',
  'service_tickets',
  'amc_contracts',
  'customer_portal',
  'google_reviews',
  'reports_export',
  'workflow_customisation',
  'audit_log',
  'notifications',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  category: 'sales' | 'operations' | 'finance' | 'service' | 'platform';
  defaultEnabled: boolean;
}

export const FEATURE_CATALOGUE: FeatureDefinition[] = [
  { key: 'leads_crm', name: 'Leads CRM', description: 'Lead capture, follow-ups and pipeline board.', category: 'sales', defaultEnabled: true },
  { key: 'site_survey', name: 'Site Survey', description: 'Structured survey form: roof type, floors, shading, geo-location, photos.', category: 'sales', defaultEnabled: true },
  { key: 'quotations', name: 'Quotations & BOQ', description: 'Versioned quotations, GST, PDF-ready printouts and BOQ.', category: 'sales', defaultEnabled: true },
  { key: 'subsidy_loan', name: 'Subsidy & Bank Loan', description: 'PM Surya Ghar subsidy and bank loan application tracking.', category: 'operations', defaultEnabled: true },
  { key: 'inventory', name: 'Warehouse Inventory', description: 'Items, stock movements, reorder alerts and stock valuation.', category: 'operations', defaultEnabled: true },
  { key: 'dispatch', name: 'Dispatch Planning', description: 'Material dispatch from warehouse to site with unloading confirmation.', category: 'operations', defaultEnabled: true },
  { key: 'net_metering', name: 'Net-Metering', description: 'DISCOM net-metering application, AE inspection and meter fixing.', category: 'operations', defaultEnabled: true },
  { key: 'expenses', name: 'Expenses & Bills', description: 'Site expenses, local BOS and electrical bills with approval.', category: 'finance', defaultEnabled: true },
  { key: 'finance_dashboard', name: 'Finance Dashboard', description: 'Receivables, collections by mode, expenses, stock value and profit.', category: 'finance', defaultEnabled: true },
  { key: 'partner_profit_split', name: 'Partner Profit Split', description: 'Partners, advances taken and profit share calculator.', category: 'finance', defaultEnabled: true },
  { key: 'service_tickets', name: 'Service Tickets', description: 'Customer service tickets with SLA, assignment and closure.', category: 'service', defaultEnabled: true },
  { key: 'amc_contracts', name: 'AMC Contracts', description: 'Annual maintenance contracts with scheduled cleaning visits.', category: 'service', defaultEnabled: false },
  { key: 'customer_portal', name: 'Customer Portal', description: 'Customers log in to track progress, documents, payments and raise tickets.', category: 'service', defaultEnabled: true },
  { key: 'google_reviews', name: 'Review Requests', description: 'Request Google review & rating after handover.', category: 'service', defaultEnabled: true },
  { key: 'reports_export', name: 'Reports Export', description: 'CSV export of projects, payments, expenses and stock.', category: 'platform', defaultEnabled: true },
  { key: 'workflow_customisation', name: 'Workflow Customisation', description: 'Admins can rename, reorder, add or disable workflow stages.', category: 'platform', defaultEnabled: true },
  { key: 'audit_log', name: 'Audit Log', description: 'Immutable log of every change for compliance.', category: 'platform', defaultEnabled: true },
  { key: 'notifications', name: 'Notifications', description: 'In-app notifications for assignments, due dates and stage changes.', category: 'platform', defaultEnabled: true },
];

export interface OrgFeatureOverride {
  enabled: boolean;
  /** Role keys allowed to use this feature. Empty = every role. */
  roles?: string[];
  /** Set by super admin: org admins cannot enable a locked feature. */
  lockedByPlatform?: boolean;
}

export type OrgFeatureMap = Partial<Record<FeatureKey, OrgFeatureOverride>>;

export function isFeatureEnabled(
  key: FeatureKey,
  orgFeatures: OrgFeatureMap | undefined,
  roleKey?: string,
  catalogue: Pick<FeatureDefinition, 'key' | 'defaultEnabled'>[] = FEATURE_CATALOGUE,
): boolean {
  const def = catalogue.find((f) => f.key === key);
  const override = orgFeatures?.[key];
  const enabled = override ? override.enabled : (def?.defaultEnabled ?? false);
  if (!enabled) return false;
  if (roleKey && override?.roles && override.roles.length > 0) {
    return roleKey === 'owner' || override.roles.includes(roleKey);
  }
  return true;
}

export function resolveFeatures(orgFeatures: OrgFeatureMap | undefined, roleKey?: string): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, isFeatureEnabled(k, orgFeatures, roleKey)])) as Record<
    FeatureKey,
    boolean
  >;
}
