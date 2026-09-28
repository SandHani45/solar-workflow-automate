import type { DocumentType, StageStatus } from './enums';
import type { FeatureKey } from './features';

/**
 * The default solar project workflow, derived from the company SOP
 * ("Solar Business Complete Flow — From Lead to Profit", 7 phases, 27 steps).
 *
 * Stages form a DAG through `dependsOn`, which lets independent tracks run in
 * parallel (e.g. operations/logistics and documentation after the advance is
 * collected), exactly like the SOP's parallel green/orange columns.
 *
 * Each org gets a copy of this template on signup and admins can customise it
 * (rename, reorder, change owner roles, required documents, checklists, form
 * fields, disable optional stages). Projects snapshot the template version
 * they were created with, so edits never corrupt in-flight projects.
 */

export type PhaseKey =
  | 'sales'
  | 'documentation'
  | 'logistics'
  | 'installation'
  | 'accounts'
  | 'net_metering'
  | 'closure';

export interface PhaseDefinition {
  key: PhaseKey;
  order: number;
  name: string;
  description: string;
  /** Tailwind-friendly colour token used by the UI. */
  color: 'blue' | 'orange' | 'green' | 'purple' | 'teal' | 'red' | 'gold';
}

export const PHASES: PhaseDefinition[] = [
  { key: 'sales', order: 1, name: 'Sales', description: 'Customer acquisition, survey and order gain', color: 'blue' },
  { key: 'documentation', order: 2, name: 'Documents & Finance', description: 'KYC documents, BOQ, subsidy, loan and advance', color: 'orange' },
  { key: 'logistics', order: 3, name: 'Logistics', description: 'Warehouse checks, dispatch, unloading and engineer allocation', color: 'green' },
  { key: 'installation', order: 4, name: 'Installation', description: 'Scheduling, installation and site photos', color: 'purple' },
  { key: 'accounts', order: 5, name: 'Accounts & Documentation', description: 'Expenses, bills and project document handover to accounts', color: 'teal' },
  { key: 'net_metering', order: 6, name: 'Net-Metering & Handover', description: 'DISCOM paperwork, inspection, meter fixing, training and review', color: 'red' },
  { key: 'closure', order: 7, name: 'Closure', description: 'Final settlement and profit sheet', color: 'gold' },
];

export type StageFieldType = 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'boolean' | 'user';

export interface StageField {
  key: string;
  label: string;
  type: StageFieldType;
  required?: boolean;
  options?: string[];
  /** For type 'user': restrict picker to users with these role keys. */
  roleFilter?: string[];
  placeholder?: string;
}

/** Automations that the backend runs when a stage is completed. */
export type StageAutomation =
  | 'lead_mark_won'
  | 'reserve_boq_stock'
  | 'set_subsidy_status'
  | 'create_dispatch'
  | 'assign_engineer'
  | 'set_installation_date'
  | 'set_net_metering_submitted'
  | 'set_net_metering_inspected'
  | 'set_net_metering_meter_installed'
  | 'request_review'
  | 'close_project';

export interface StageDefinition {
  key: string;
  /** Step number from the SOP, used for display. */
  step: number;
  name: string;
  description: string;
  phase: PhaseKey;
  dependsOn: string[];
  /** Roles responsible. Users with these roles (or workflow:override) can complete it. */
  ownerRoles: string[];
  requiredDocuments: DocumentType[];
  checklist: string[];
  fields: StageField[];
  /** Stage is only active when this feature is enabled for the org. */
  feature?: FeatureKey;
  /** Optional stages can be skipped by the owner role. */
  optional?: boolean;
  /** Target turnaround in days from when the stage becomes available. */
  slaDays: number;
  /** Completion requires full contract amount to be received. */
  requiresFullPayment?: boolean;
  /** Completion requires at least the configured advance % to be received. */
  requiresAdvancePayment?: boolean;
  automations?: StageAutomation[];
  /** Admin-disabled stages are treated as skipped. */
  enabled?: boolean;
}

export const DEFAULT_STAGES: StageDefinition[] = [
  // ───────────── Phase 1 — Sales ─────────────
  {
    key: 'quotation_sent', step: 1, phase: 'sales', name: 'Quotation Sent to Customer',
    description: 'Send the initial quotation/proposal to the customer.',
    dependsOn: [], ownerRoles: ['sales', 'manager'], requiredDocuments: [], slaDays: 2,
    checklist: ['Understand monthly consumption from electricity bill', 'Recommend system size (kW)', 'Share initial quotation'],
    fields: [
      { key: 'monthlyUnits', label: 'Avg. monthly units (kWh)', type: 'number' },
      { key: 'proposedKw', label: 'Proposed system size (kW)', type: 'number', required: true },
      { key: 'quotedAmount', label: 'Quoted amount', type: 'currency', required: true },
    ],
  },
  {
    key: 'site_survey', step: 2, phase: 'sales', name: 'Site Survey Visit',
    description: 'Assess site location, roof type, number of floors and shading.',
    dependsOn: ['quotation_sent'], ownerRoles: ['sales', 'engineer', 'manager'], requiredDocuments: ['survey_photo'], slaDays: 3,
    feature: 'site_survey',
    checklist: ['Capture geo-location', 'Check roof strength & orientation', 'Check shadow-free area', 'Measure cable route to DB/meter', 'Take roof photos'],
    fields: [
      { key: 'surveyDate', label: 'Survey date', type: 'date', required: true },
      { key: 'roofType', label: 'Roof type', type: 'select', options: ['rcc', 'metal_sheet', 'asbestos', 'tile', 'ground_mount', 'other'], required: true },
      { key: 'floors', label: 'Number of floors', type: 'number', required: true },
      { key: 'shadowFreeAreaSqft', label: 'Shadow-free area (sq.ft)', type: 'number' },
      { key: 'sanctionedLoadKw', label: 'Sanctioned load (kW)', type: 'number' },
      { key: 'structureHeightFt', label: 'Structure height (ft)', type: 'number' },
      { key: 'notes', label: 'Survey notes', type: 'textarea' },
    ],
  },
  {
    key: 'final_quotation', step: 3, phase: 'sales', name: 'Final Quotation & Order Gain',
    description: 'Finalise the quotation and secure the customer order.',
    dependsOn: ['site_survey'], ownerRoles: ['sales', 'manager'], requiredDocuments: [], slaDays: 5,
    checklist: ['Final quotation accepted by customer', 'Payment terms agreed', 'Order confirmation received'],
    fields: [
      { key: 'finalKw', label: 'Final system size (kW)', type: 'number', required: true },
      { key: 'contractValue', label: 'Final contract value', type: 'currency', required: true },
      { key: 'orderDate', label: 'Order date', type: 'date', required: true },
    ],
    automations: ['lead_mark_won'],
  },

  // ───────────── Phase 2 — Documents & Finance ─────────────
  {
    key: 'documents_collection', step: 4, phase: 'documentation', name: 'Documents Collection',
    description: 'Collect Aadhaar, PAN, bank passbook and electricity bill.',
    dependsOn: ['final_quotation'], ownerRoles: ['operations', 'sales'], slaDays: 3,
    requiredDocuments: ['aadhaar', 'pan', 'bank_passbook', 'electricity_bill'],
    checklist: ['Name matches across documents', 'Electricity bill is latest', 'Consumer number verified'],
    fields: [{ key: 'consumerNumber', label: 'Electricity consumer number', type: 'text', required: true }],
  },
  {
    key: 'boq_preparation', step: 5, phase: 'documentation', name: 'BOQ Preparation',
    description: 'Prepare the Bill of Quantities for the project.',
    dependsOn: ['final_quotation'], ownerRoles: ['operations', 'manager'], requiredDocuments: [], slaDays: 2,
    checklist: ['Modules & inverter selected', 'Structure & BOS listed', 'BOQ added to project'],
    fields: [],
    automations: ['reserve_boq_stock'],
  },
  {
    key: 'subsidy_loan', step: 6, phase: 'documentation', name: 'Apply for Subsidy & Bank Loan',
    description: 'Apply for subsidy (PM Surya Ghar) and submit bank loan application if needed.',
    dependsOn: ['documents_collection'], ownerRoles: ['operations'], requiredDocuments: [], slaDays: 5,
    feature: 'subsidy_loan', optional: true,
    checklist: ['Registered on national portal', 'Subsidy application submitted', 'Loan application submitted (if required)'],
    fields: [
      { key: 'subsidyApplicationNo', label: 'Subsidy application no.', type: 'text' },
      { key: 'subsidyAmount', label: 'Expected subsidy', type: 'currency' },
      { key: 'loanRequired', label: 'Bank loan required', type: 'boolean' },
      { key: 'loanBank', label: 'Bank', type: 'text' },
      { key: 'loanAmount', label: 'Loan amount', type: 'currency' },
    ],
    automations: ['set_subsidy_status'],
  },
  {
    key: 'advance_payment', step: 7, phase: 'documentation', name: 'Advance Payment Collection',
    description: 'Collect the agreed advance payment from the customer.',
    dependsOn: ['final_quotation'], ownerRoles: ['accounts', 'sales'], requiredDocuments: [], slaDays: 3,
    requiresAdvancePayment: true,
    checklist: ['Advance received', 'Receipt shared with customer'],
    fields: [],
  },

  // ───────────── Phase 3 — Logistics ─────────────
  {
    key: 'material_check', step: 8, phase: 'logistics', name: 'Material Checking in Warehouse',
    description: 'Verify BOQ materials and update the warehouse stock list & value.',
    dependsOn: ['boq_preparation', 'advance_payment'], ownerRoles: ['warehouse'], requiredDocuments: [], slaDays: 2,
    feature: 'inventory',
    checklist: ['All BOQ items available', 'Serial numbers noted', 'Damaged items separated', 'Stock list & value updated'],
    fields: [{ key: 'shortages', label: 'Shortages / items to procure', type: 'textarea' }],
  },
  {
    key: 'dispatch_planning', step: 9, phase: 'logistics', name: 'Material Dispatch Planning',
    description: 'Plan material dispatch from warehouse to site.',
    dependsOn: ['material_check'], ownerRoles: ['warehouse', 'manager'], requiredDocuments: [], slaDays: 2,
    feature: 'dispatch',
    checklist: ['Vehicle arranged', 'Items packed per BOQ', 'Customer informed of delivery'],
    fields: [
      { key: 'dispatchDate', label: 'Dispatch date', type: 'date', required: true },
      { key: 'vehicleNo', label: 'Vehicle number', type: 'text' },
      { key: 'driverPhone', label: 'Driver phone', type: 'text' },
    ],
    automations: ['create_dispatch'],
  },
  {
    key: 'material_unloading', step: 10, phase: 'logistics', name: 'Unloading Material in Safe Area',
    description: 'Unload materials safely in the designated area at site.',
    dependsOn: ['dispatch_planning'], ownerRoles: ['warehouse', 'engineer'], requiredDocuments: [], slaDays: 1,
    checklist: ['All items delivered', 'Stored in safe covered area', 'Customer acknowledgement taken'],
    fields: [{ key: 'unloadedAt', label: 'Unloaded on', type: 'date', required: true }],
  },
  {
    key: 'engineer_allocation', step: 11, phase: 'logistics', name: 'Project Engineer Allocation',
    description: 'Allocate a project engineer and confirm the site location.',
    dependsOn: ['advance_payment'], ownerRoles: ['manager'], requiredDocuments: [], slaDays: 1,
    checklist: ['Engineer briefed on survey & BOQ', 'Site location confirmed'],
    fields: [{ key: 'engineerId', label: 'Project engineer', type: 'user', roleFilter: ['engineer'], required: true }],
    automations: ['assign_engineer'],
  },

  // ───────────── Phase 4 — Installation ─────────────
  {
    key: 'installation_schedule', step: 12, phase: 'installation', name: 'Installation Schedule Date Fix',
    description: 'Fix and confirm the installation schedule date with the customer.',
    dependsOn: ['engineer_allocation', 'dispatch_planning'], ownerRoles: ['manager', 'engineer'], requiredDocuments: [], slaDays: 2,
    checklist: ['Customer confirmed date', 'Crew available'],
    fields: [
      { key: 'installationDate', label: 'Installation date', type: 'date', required: true },
      { key: 'crewSize', label: 'Crew size', type: 'number' },
    ],
    automations: ['set_installation_date'],
  },
  {
    key: 'installation', step: 13, phase: 'installation', name: 'Installation as per Schedule',
    description: 'Engineer completes the installation as per schedule.',
    dependsOn: ['installation_schedule', 'material_unloading'], ownerRoles: ['engineer'], requiredDocuments: [], slaDays: 3,
    checklist: ['Structure erected', 'Modules mounted', 'Inverter installed', 'DC & AC cabling done', 'Earthing & lightning arrestor', 'System commissioned & generating'],
    fields: [
      { key: 'completedOn', label: 'Completed on', type: 'date', required: true },
      { key: 'inverterSerial', label: 'Inverter serial no.', type: 'text' },
      { key: 'moduleSerials', label: 'Module serial nos.', type: 'textarea' },
    ],
  },
  {
    key: 'site_photos', step: 14, phase: 'installation', name: 'Site Team Uploads Photos',
    description: 'Site team uploads modules, inverter and site photos to the app.',
    dependsOn: ['installation'], ownerRoles: ['engineer'], slaDays: 1,
    requiredDocuments: ['module_photo', 'inverter_photo', 'site_photo'],
    checklist: ['Module array photo', 'Inverter with serial photo', 'Overall site photo'],
    fields: [],
  },

  // ───────────── Phase 5 — Accounts & Documentation ─────────────
  {
    key: 'expenses_bills', step: 15, phase: 'accounts', name: 'Expenses, Local BOS & Electrical Bills',
    description: 'Share expenses, local BOS and electrical bills with the accounts team.',
    dependsOn: ['installation'], ownerRoles: ['engineer', 'accounts'], requiredDocuments: [], slaDays: 2,
    feature: 'expenses',
    checklist: ['All site expenses recorded', 'Bills uploaded', 'Accounts team verified'],
    fields: [],
  },
  {
    key: 'project_documents', step: 16, phase: 'accounts', name: 'Upload Project Documents',
    description: 'Upload warranty, invoices, DCR certificate, agreement and feasibility letter.',
    dependsOn: ['installation'], ownerRoles: ['operations', 'accounts'], slaDays: 3,
    requiredDocuments: ['warranty', 'invoice', 'dcr_certificate', 'agreement', 'feasibility_letter'],
    checklist: ['Warranty cards collected', 'Invoice generated', 'DCR certificate obtained'],
    fields: [{ key: 'invoiceNo', label: 'Invoice number', type: 'text', required: true }],
  },

  // ───────────── Phase 6 — Net-Metering & Handover ─────────────
  {
    key: 'net_metering_submission', step: 17, phase: 'net_metering', name: 'Net-Metering Documents Submission',
    description: 'Submit net-metering documents to the electricity department (DISCOM).',
    dependsOn: ['project_documents'], ownerRoles: ['operations'], requiredDocuments: ['net_metering_application'], slaDays: 3,
    feature: 'net_metering',
    checklist: ['Application submitted to DISCOM', 'Acknowledgement received'],
    fields: [
      { key: 'netMeteringAppNo', label: 'Application number', type: 'text', required: true },
      { key: 'submittedOn', label: 'Submitted on', type: 'date', required: true },
    ],
    automations: ['set_net_metering_submitted'],
  },
  {
    key: 'ae_inspection_followup', step: 18, phase: 'net_metering', name: 'AE Site Inspection Follow-up',
    description: 'Follow up with the Assistant Engineer (AE) for site inspection.',
    dependsOn: ['net_metering_submission'], ownerRoles: ['operations'], requiredDocuments: [], slaDays: 7,
    feature: 'net_metering',
    checklist: ['Inspection date obtained from AE', 'Customer informed'],
    fields: [{ key: 'inspectionDate', label: 'Inspection date', type: 'date', required: true }],
  },
  {
    key: 'inspection_done', step: 19, phase: 'net_metering', name: 'Inspection Done',
    description: 'Site inspection is completed and approved.',
    dependsOn: ['ae_inspection_followup'], ownerRoles: ['operations', 'engineer'], requiredDocuments: [], slaDays: 3,
    feature: 'net_metering',
    checklist: ['Inspection passed', 'Observations (if any) resolved'],
    fields: [{ key: 'inspectedBy', label: 'Inspected by (AE name)', type: 'text' }],
    automations: ['set_net_metering_inspected'],
  },
  {
    key: 'meter_fixing', step: 20, phase: 'net_metering', name: 'Bi-directional Meter Fixing',
    description: 'DISCOM / meter vendor (e.g. Adani) fixes and installs the bi-directional (net) meter.',
    dependsOn: ['inspection_done'], ownerRoles: ['operations', 'engineer'], requiredDocuments: [], slaDays: 7,
    feature: 'net_metering',
    checklist: ['Net meter installed', 'Meter reading at installation recorded'],
    fields: [
      { key: 'meterNumber', label: 'Net meter number', type: 'text', required: true },
      { key: 'meterInstalledOn', label: 'Installed on', type: 'date', required: true },
    ],
    automations: ['set_net_metering_meter_installed'],
  },
  {
    key: 'client_training', step: 21, phase: 'net_metering', name: 'Client Training & App Generation',
    description: 'Train the client on cleaning cycle, plant operation and set up the monitoring app.',
    dependsOn: ['meter_fixing', 'site_photos'], ownerRoles: ['engineer', 'service'], requiredDocuments: [], slaDays: 2,
    checklist: ['Cleaning cycle explained', 'Plant operation explained', 'Monitoring app installed & login shared', 'Customer portal access shared'],
    fields: [{ key: 'monitoringAppId', label: 'Monitoring app / plant ID', type: 'text' }],
  },
  {
    key: 'review_request', step: 22, phase: 'net_metering', name: 'Google Review & Rating',
    description: 'Ask the client for Google review and rating feedback.',
    dependsOn: ['client_training'], ownerRoles: ['sales', 'service', 'manager'], requiredDocuments: [], slaDays: 3,
    feature: 'google_reviews', optional: true,
    checklist: ['Review link shared'],
    fields: [{ key: 'rating', label: 'Customer rating (1-5)', type: 'number' }],
    automations: ['request_review'],
  },

  // ───────────── Phase 7 — Closure ─────────────
  {
    key: 'project_closure', step: 23, phase: 'closure', name: 'Project Closed & Profit Sheet',
    description: 'Final settlement received; profit sheet generated in the app.',
    dependsOn: ['client_training', 'expenses_bills'], ownerRoles: ['accounts', 'owner'], requiredDocuments: [], slaDays: 7,
    requiresFullPayment: true,
    checklist: ['Full payment received', 'Subsidy credited / tracked', 'All expenses approved', 'Profit sheet reviewed'],
    fields: [],
    automations: ['close_project'],
  },
];

export const DEFAULT_ADVANCE_PERCENT = 30;

// ─────────────────────────── Engine helpers (pure, shared by API + UI) ───────────────────────────

export interface ProjectStageState {
  key: string;
  status: StageStatus;
  checklist?: { label: string; done: boolean }[];
  data?: Record<string, unknown>;
}

/** Stage keys that are effectively finished (completed or skipped). */
export function isStageDone(status: StageStatus | undefined): boolean {
  return status === 'completed' || status === 'skipped';
}

/**
 * Recompute locked/pending status for every stage from its dependencies.
 * Completed/skipped/in_progress/blocked states are preserved.
 */
export function computeStageAvailability<T extends ProjectStageState>(stages: T[], definitions: StageDefinition[]): T[] {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  return stages.map((s) => {
    if (s.status !== 'locked' && s.status !== 'pending') return s;
    const def = definitions.find((d) => d.key === s.key);
    const ready = (def?.dependsOn ?? []).every((dep) => {
      const depState = byKey.get(dep);
      // Missing dependency (removed/disabled stage) counts as done.
      return !depState || isStageDone(depState.status);
    });
    return { ...s, status: ready ? 'pending' : 'locked' } as T;
  });
}

export function projectProgress(stages: Pick<ProjectStageState, 'status'>[]): number {
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => isStageDone(s.status)).length;
  return Math.round((done / stages.length) * 100);
}

/** The phase the project is "in": the earliest phase with unfinished stages. */
export function currentPhase(stages: ProjectStageState[], definitions: StageDefinition[]): PhaseKey {
  for (const phase of PHASES) {
    const phaseStages = definitions.filter((d) => d.phase === phase.key);
    const unfinished = phaseStages.some((d) => {
      const s = stages.find((x) => x.key === d.key);
      return s && !isStageDone(s.status);
    });
    if (unfinished) return phase.key;
  }
  return 'closure';
}

/** Validate a stage definition set: unique keys, known deps, no cycles. Returns error strings. */
export function validateWorkflow(definitions: StageDefinition[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const d of definitions) {
    if (keys.has(d.key)) errors.push(`Duplicate stage key "${d.key}"`);
    keys.add(d.key);
  }
  for (const d of definitions) {
    for (const dep of d.dependsOn) if (!keys.has(dep)) errors.push(`Stage "${d.key}" depends on unknown stage "${dep}"`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byKey = new Map(definitions.map((d) => [d.key, d]));
  const visit = (k: string): boolean => {
    if (visited.has(k)) return false;
    if (visiting.has(k)) return true;
    visiting.add(k);
    const cyc = (byKey.get(k)?.dependsOn ?? []).some(visit);
    visiting.delete(k);
    visited.add(k);
    return cyc;
  };
  if (definitions.some((d) => visit(d.key))) errors.push('Workflow has a dependency cycle');
  return errors;
}
