import type { FeatureKey, OrgPlan } from '@solar/shared';

/**
 * Marketing plan catalogue. `@solar/shared` defines the plan keys (ORG_PLANS) but not prices or
 * bundles, so they live here. Platform admins still control actual entitlements per tenant.
 */
export interface Plan {
  key: OrgPlan;
  name: string;
  tagline: string;
  monthly: number | null;
  yearlyMonthly: number | null;
  users: string;
  projects: string;
  features: FeatureKey[];
  extras: string[];
  highlighted?: boolean;
  cta: string;
}

const STARTER: FeatureKey[] = ['leads_crm', 'site_survey', 'quotations', 'subsidy_loan', 'net_metering', 'customer_portal', 'google_reviews', 'notifications'];
const GROWTH: FeatureKey[] = [...STARTER, 'inventory', 'dispatch', 'expenses', 'finance_dashboard', 'service_tickets', 'reports_export', 'workflow_customisation', 'audit_log'];
const ENTERPRISE: FeatureKey[] = [...GROWTH, 'partner_profit_split', 'amc_contracts'];

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For new installers doing their first 50 rooftops.',
    monthly: 2499,
    yearlyMonthly: 1999,
    users: 'Up to 5 users',
    projects: '25 active projects',
    features: STARTER,
    extras: ['7-phase workflow template', 'Email support'],
    cta: 'Start free trial',
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'For EPCs running multiple crews, a warehouse and a service desk.',
    monthly: 6999,
    yearlyMonthly: 5599,
    users: 'Up to 25 users',
    projects: 'Unlimited projects',
    features: GROWTH,
    extras: ['Guided onboarding call', 'Priority WhatsApp support'],
    highlighted: true,
    cta: 'Start free trial',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For multi-branch companies and partnerships that need it all.',
    monthly: null,
    yearlyMonthly: null,
    users: 'Unlimited users',
    projects: 'Unlimited projects',
    features: ENTERPRISE,
    extras: ['Multi-branch organisations', 'Dedicated onboarding & data migration', 'Uptime SLA'],
    cta: 'Talk to sales',
  },
];
