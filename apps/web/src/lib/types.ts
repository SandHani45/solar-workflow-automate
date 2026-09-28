/**
 * Response shapes from docs/API.md. Request bodies come from the zod schemas in @solar/shared.
 * Where API.md leaves a field unspecified, it is typed optional and the UI degrades gracefully.
 */
import type {
  AdvanceStatus,
  ConnectionType,
  CustomerType,
  DispatchStatus,
  DocumentType,
  ExpenseCategory,
  ExpenseStatus,
  FeatureDefinition,
  FeatureKey,
  ItemCategory,
  LeadSource,
  LeadStatus,
  LoanStatus,
  NetMeteringStatus,
  OrgFeatureMap,
  OrgPlan,
  Partner,
  PaymentMode,
  PaymentType,
  PhaseDefinition,
  PhaseKey,
  ProfitSplitRow,
  ProjectStatus,
  QuotationKind,
  QuotationLine,
  QuotationStatus,
  StageDefinition,
  StageStatus,
  StockMovementType,
  SubsidyStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@solar/shared';

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  unread?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: ListMeta;
}

export type ListParams = Record<string, string | number | boolean | null | undefined>;

export interface UserRef {
  id: string;
  name: string;
  email: string;
  roleKey: string;
}

export interface Address {
  line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
}

// ── Auth / org ──
export interface OrgSettings {
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  logoUrl?: string;
  googleReviewUrl?: string;
  advancePercent?: number;
  defaultGstPercent?: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: string;
  isSuperAdmin: boolean;
  avatarUrl?: string;
  lastLoginAt?: string;
}

export interface Session {
  user: SessionUser;
  org: { id: string; name: string; slug: string; plan: OrgPlan; logoUrl?: string; settings: OrgSettings } | null;
  role: { key: string; name: string; permissions: string[] } | null;
  permissions: string[];
  features: Record<FeatureKey, boolean>;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  settings: OrgSettings;
  partners: Partner[];
  features: OrgFeatureMap;
}

export interface OrgFeature extends FeatureDefinition {
  enabled: boolean;
  roles: string[];
  lockedByPlatform: boolean;
}

export interface Workflow {
  version: number;
  phases: PhaseDefinition[];
  stages: StageDefinition[];
}

export interface InviteInfo {
  email: string;
  orgName: string;
  roleName: string;
}

// ── Users & roles ──
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserOption {
  id: string;
  name: string;
  roleKey: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

// ── Audit / activity ──
export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  user: UserRef | null;
  changes?: Record<string, unknown>;
  createdAt: string;
}

// ── Dashboard ──
export interface MyTask {
  projectId: string;
  projectCode: string;
  customerName: string;
  stageKey: string;
  stageName: string;
  status: StageStatus;
  dueAt?: string;
  overdue: boolean;
}

export interface Dashboard {
  kpis: {
    activeProjects: number;
    completedThisMonth: number;
    newLeads: number;
    pipelineValue: number;
    collectedThisMonth: number;
    openTickets: number;
    overdueStages: number;
    lowStockItems: number;
  };
  projectsByPhase: { phase: PhaseKey; count: number }[];
  myTasks: MyTask[];
  recentActivity: AuditEntry[];
  upcomingInstallations: { projectId: string; projectCode: string; customerName: string; date: string; engineer?: UserRef }[];
  monthlyCollections?: { month: string; amount: number }[];
}

// ── Leads ──
export type LeadActivityType = 'call' | 'whatsapp' | 'visit' | 'email' | 'note';

export interface Lead {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: Address;
  customerType: CustomerType;
  source: LeadSource;
  status: LeadStatus;
  monthlyBill?: number;
  requiredKw?: number;
  assignedTo: UserRef | null;
  followUpAt?: string | null;
  notes?: string;
  lostReason?: string;
  projectId?: string | null;
  activities?: { id: string; type: LeadActivityType; note: string; by: UserRef; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export type LeadBoard = Partial<Record<LeadStatus, Lead[]>>;

// ── Projects ──
export interface ProjectStage {
  key: string;
  status: StageStatus;
  assignee?: UserRef | null;
  startedAt?: string;
  completedAt?: string;
  completedBy?: UserRef;
  dueAt?: string;
  checklist: { label: string; done: boolean }[];
  data: Record<string, unknown>;
  notes: { body: string; by: UserRef; at: string }[];
  blockedReason?: string;
}

export interface BoqLine {
  itemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface Project {
  id: string;
  code: string;
  status: ProjectStatus;
  customer: { name: string; phone: string; email?: string; address?: Address; consumerNumber?: string };
  customerType: CustomerType;
  connectionType: ConnectionType;
  systemSizeKw: number;
  contractValue: number;
  expectedSubsidy?: number;
  team: { sales?: UserRef; manager?: UserRef; engineer?: UserRef; operations?: UserRef };
  customerUserId?: string;
  leadId?: string;
  workflowVersion: number;
  stageDefinitions: StageDefinition[];
  stages: ProjectStage[];
  currentPhase: PhaseKey;
  progress: number;
  boq: BoqLine[];
  survey?: { roofType?: string; floors?: number; shadowFreeAreaSqft?: number; sanctionedLoadKw?: number; surveyDate?: string; notes?: string };
  subsidy: { status: SubsidyStatus; applicationNo?: string; amount?: number };
  loan: { status: LoanStatus; bank?: string; amount?: number };
  netMetering: { status: NetMeteringStatus; applicationNo?: string; meterNumber?: string; inspectionDate?: string };
  installationDate?: string;
  completedAt?: string;
  rating?: number;
  documentsCount: number;
  financialSummary?: { received: number; pending: number };
  createdAt: string;
  updatedAt: string;
}

/** Board cards: API.md says `ProjectSummary`; we rely only on these fields. */
export type ProjectSummary = Pick<Project, 'id' | 'code' | 'status' | 'customer' | 'systemSizeKw' | 'contractValue' | 'currentPhase' | 'progress'> &
  Partial<Pick<Project, 'team' | 'installationDate' | 'financialSummary'>>;

export type ProjectBoard = Partial<Record<PhaseKey, ProjectSummary[]>>;

export interface ProjectComment {
  id: string;
  body: string;
  by: UserRef;
  at?: string;
  createdAt?: string;
}

export interface ProjectFinancials {
  contractValue: number;
  received: number;
  pending: number;
  /** API.md lists `expenses` both as a total and as a list; accept either (see `financialsExpenseTotal`). */
  expenses?: number | Expense[];
  materialCost?: number;
  profit?: number;
  payments: Payment[];
}

// ── Quotations ──
export interface Quotation {
  id: string;
  number: string;
  version: number;
  kind: QuotationKind;
  status: QuotationStatus;
  projectId?: string;
  leadId?: string;
  systemSizeKw: number;
  lines: QuotationLine[];
  discount: number;
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  validUntil?: string;
  terms?: string;
  notes?: string;
  customer?: { name?: string; phone?: string; email?: string; address?: Address | string };
  project?: { id?: string; code: string; customerName?: string };
  lead?: { id?: string; code: string; name?: string };
  org?: { name: string; address?: string; phone?: string; email?: string; gstin?: string; logoUrl?: string };
  createdBy?: UserRef;
  createdAt: string;
}

// ── Documents ──
export interface ProjectDocument {
  id: string;
  projectId?: string;
  type: DocumentType;
  stageKey?: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: UserRef;
  note?: string;
  createdAt: string;
}

// ── Inventory ──
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ItemCategory;
  brand?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  gstPercent: number;
  specs?: string;
  quantity: number;
  reserved: number;
  available: number;
  stockValue: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  item?: { id: string; name: string; sku: string; unit?: string };
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  projectId?: string;
  project?: { code: string; customerName?: string };
  reference?: string;
  note?: string;
  by?: UserRef;
  createdAt: string;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStock: InventoryItem[];
  byCategory: { category: ItemCategory; value: number; quantity: number }[];
}

export interface Dispatch {
  id: string;
  code: string;
  projectId: string;
  project?: { code: string; customerName?: string; address?: Address | string };
  items: { itemId: string; name?: string; sku?: string; unit?: string; quantity: number }[];
  scheduledDate: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  status: DispatchStatus;
  history?: { status: DispatchStatus; at: string; by?: UserRef; note?: string }[];
  createdAt: string;
}

// ── Finance ──
export interface Payment {
  id: string;
  receiptNo?: string;
  projectId: string;
  project?: { code: string; customerName?: string };
  amount: number;
  mode: PaymentMode;
  type: PaymentType;
  receivedAt: string;
  reference?: string;
  note?: string;
  recordedBy?: UserRef;
  createdAt: string;
}

export interface Expense {
  id: string;
  projectId?: string | null;
  project?: { code: string; customerName?: string } | null;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor?: string;
  incurredAt: string;
  paidBy: 'company' | 'employee' | 'partner';
  status: ExpenseStatus;
  submittedBy?: UserRef;
  decidedBy?: UserRef;
  decisionNote?: string;
  createdAt: string;
}

export interface Advance {
  id: string;
  personName: string;
  userId?: string;
  kind: 'employee' | 'partner';
  amount: number;
  takenAt: string;
  note?: string;
  status: AdvanceStatus;
  settledAt?: string;
}

export interface FinanceDashboard {
  totals: {
    contractValue: number;
    received: number;
    pending: number;
    expenses: number;
    materialCost: number;
    advancesOutstanding: number;
    stockValue: number;
    profit: number;
  };
  receivedByMode: { mode: PaymentMode; amount: number }[];
  expensesByCategory: { category: ExpenseCategory; amount: number }[];
  pendingCustomers: { projectId: string; code: string; customerName: string; phone: string; contractValue: number; received: number; pending: number; lastPaymentAt?: string }[];
  advances: { personName: string; kind: 'employee' | 'partner'; outstanding: number }[];
  partnerSplit?: ProfitSplitRow[];
  monthly: { month: string; received: number; expenses: number }[];
  projectProfit: { projectId: string; code: string; customerName: string; received: number; expenses: number; materialCost: number; profit: number }[];
}

// ── Service ──
export interface Ticket {
  id: string;
  code: string;
  projectId: string;
  project?: { code: string; customerName: string };
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: UserRef | null;
  raisedBy: UserRef;
  dueAt?: string;
  overdue: boolean;
  resolvedAt?: string;
  closedAt?: string;
  resolution?: string;
  comments?: { id: string; body: string; by: UserRef; at: string }[];
  createdAt: string;
}

export interface AmcContract {
  id: string;
  projectId: string;
  project?: { code: string; customerName?: string };
  startDate: string;
  endDate: string;
  visitsPerYear: number;
  amount: number;
  notes?: string;
  visits: { id: string; dueDate: string; done: boolean; doneAt?: string; note?: string }[];
  createdAt?: string;
}

// ── Notifications / search ──
export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface SearchResults {
  projects: { id: string; code: string; customer?: { name: string; phone?: string }; customerName?: string; currentPhase?: PhaseKey }[];
  leads: { id: string; code: string; name: string; phone?: string; status?: LeadStatus }[];
  tickets: { id: string; code: string; subject: string; status?: TicketStatus }[];
}

// ── Platform ──
export interface PlatformStats {
  orgs: number;
  activeOrgs: number;
  users: number;
  projects: number;
}

export interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  isActive: boolean;
  users?: number;
  projects?: number;
  createdAt: string;
  features?: OrgFeatureMap;
  settings?: OrgSettings;
}

export interface PlatformFeature extends FeatureDefinition {
  id?: string;
}
