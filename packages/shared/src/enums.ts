export const LEAD_STATUSES = ['new', 'contacted', 'quotation_sent', 'survey_scheduled', 'negotiation', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['walk_in', 'referral', 'website', 'social_media', 'phone', 'campaign', 'partner', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STAGE_STATUSES = ['locked', 'pending', 'in_progress', 'blocked', 'completed', 'skipped'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const ROOF_TYPES = ['rcc', 'metal_sheet', 'asbestos', 'tile', 'ground_mount', 'other'] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const CONNECTION_TYPES = ['on_grid', 'off_grid', 'hybrid'] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const CUSTOMER_TYPES = ['residential', 'commercial', 'industrial', 'agricultural'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'bank_passbook',
  'electricity_bill',
  'property_proof',
  'quotation',
  'boq',
  'agreement',
  'feasibility_letter',
  'subsidy_application',
  'loan_sanction',
  'warranty',
  'invoice',
  'dcr_certificate',
  'net_metering_application',
  'inspection_report',
  'commissioning_certificate',
  'site_photo',
  'module_photo',
  'inverter_photo',
  'survey_photo',
  'expense_bill',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  bank_passbook: 'Bank Passbook',
  electricity_bill: 'Electricity Bill',
  property_proof: 'Property Proof',
  quotation: 'Quotation',
  boq: 'Bill of Quantities',
  agreement: 'Agreement',
  feasibility_letter: 'Feasibility Letter',
  subsidy_application: 'Subsidy Application',
  loan_sanction: 'Loan Sanction Letter',
  warranty: 'Warranty Card',
  invoice: 'Invoice',
  dcr_certificate: 'DCR Certificate',
  net_metering_application: 'Net-Metering Application',
  inspection_report: 'Inspection Report',
  commissioning_certificate: 'Commissioning Certificate',
  site_photo: 'Site Photo',
  module_photo: 'Module Photo',
  inverter_photo: 'Inverter Photo',
  survey_photo: 'Survey Photo',
  expense_bill: 'Expense Bill',
  other: 'Other',
};

export const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'superseded'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_KINDS = ['initial', 'final'] as const;
export type QuotationKind = (typeof QUOTATION_KINDS)[number];

export const PAYMENT_MODES = ['phonepe', 'upi', 'company_account', 'bank_transfer', 'cash', 'cheque', 'loan_disbursement', 'subsidy_credit'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_TYPES = ['advance', 'milestone', 'final', 'subsidy', 'loan', 'refund'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const EXPENSE_CATEGORIES = ['local_bos', 'electrical', 'transport', 'labour', 'civil', 'fees_permits', 'food_travel', 'tools', 'office', 'salary', 'misc'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const ITEM_CATEGORIES = ['module', 'inverter', 'structure', 'cable', 'meter', 'battery', 'earthing', 'bos', 'other'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const STOCK_MOVEMENT_TYPES = ['in', 'out', 'adjust', 'return'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const DISPATCH_STATUSES = ['planned', 'packed', 'in_transit', 'delivered', 'unloaded', 'cancelled'] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** SLA in hours to resolve by priority. */
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = { low: 120, medium: 72, high: 24, critical: 8 };

export const TICKET_CATEGORIES = ['low_generation', 'inverter_error', 'physical_damage', 'cleaning', 'meter_issue', 'app_monitoring', 'billing', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const SUBSIDY_STATUSES = ['not_applied', 'applied', 'under_review', 'approved', 'disbursed', 'rejected'] as const;
export type SubsidyStatus = (typeof SUBSIDY_STATUSES)[number];

export const LOAN_STATUSES = ['not_required', 'applied', 'sanctioned', 'disbursed', 'rejected'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const NET_METERING_STATUSES = ['not_started', 'submitted', 'inspection_scheduled', 'inspected', 'meter_installed', 'rejected'] as const;
export type NetMeteringStatus = (typeof NET_METERING_STATUSES)[number];

export const ADVANCE_STATUSES = ['outstanding', 'settled'] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

export const ORG_PLANS = ['starter', 'growth', 'enterprise'] as const;
export type OrgPlan = (typeof ORG_PLANS)[number];

/** Convert snake_case enum values to human labels. */
export function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => (w.length <= 3 && w === w.toLowerCase() && ['bos', 'upi', 'amc', 'dcr', 'boq', 'rcc', 'pan'].includes(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
