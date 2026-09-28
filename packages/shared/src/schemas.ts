import { z } from 'zod';
import {
  CONNECTION_TYPES,
  CUSTOMER_TYPES,
  DISPATCH_STATUSES,
  DOCUMENT_TYPES,
  EXPENSE_CATEGORIES,
  ITEM_CATEGORIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  ORG_PLANS,
  PAYMENT_MODES,
  PAYMENT_TYPES,
  PROJECT_STATUSES,
  QUOTATION_KINDS,
  STOCK_MOVEMENT_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from './enums';
import { ALL_PERMISSIONS } from './permissions';
import { FEATURE_KEYS } from './features';

/**
 * Request body schemas shared by the API (validation) and the web app (forms).
 * IDs are 24-char Mongo ObjectId hex strings.
 */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,17}$/, 'Invalid phone number');
const money = z.coerce.number().min(0).max(1e10);
const optionalDate = z.coerce.date().optional();

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export const registerOrgSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  password: passwordSchema,
});
export type RegisterOrgInput = z.infer<typeof registerOrgSchema>;

export const acceptInviteSchema = z.object({ token: z.string().min(10), name: z.string().trim().min(2), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(10), password: passwordSchema });

// ── Users & roles ──
export const inviteUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  roleKey: z.string().min(2),
  /** When set, the user is created active with this password instead of an invite link. */
  password: passwordSchema.optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
  roleKey: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

export const roleSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,40}$/, 'lowercase letters, digits, underscore'),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().default(''),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
});
export type RoleInput = z.infer<typeof roleSchema>;

// ── Organisation / features ──
export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  gstin: z.string().max(20).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  googleReviewUrl: z.string().url().optional().or(z.literal('')),
  advancePercent: z.coerce.number().min(0).max(100).optional(),
  defaultGstPercent: z.coerce.number().min(0).max(28).optional(),
});

export const orgFeatureUpdateSchema = z.object({
  key: z.enum(FEATURE_KEYS),
  enabled: z.boolean(),
  roles: z.array(z.string()).optional(),
});

export const partnersSchema = z.object({
  partners: z
    .array(z.object({ name: z.string().trim().min(1), sharePercent: z.coerce.number().min(0).max(100), userId: objectId.optional() }))
    .refine((ps) => ps.length === 0 || Math.abs(ps.reduce((s, p) => s + p.sharePercent, 0) - 100) < 0.01, 'Shares must add up to 100%'),
});

export const platformOrgUpdateSchema = z.object({
  plan: z.enum(ORG_PLANS).optional(),
  isActive: z.boolean().optional(),
  features: z.record(z.string(), z.object({ enabled: z.boolean(), lockedByPlatform: z.boolean().optional(), roles: z.array(z.string()).optional() })).optional(),
});

// ── Leads ──
const addressSchema = z.object({
  line1: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  district: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  pincode: z.string().trim().max(10).optional().default(''),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  address: addressSchema.optional(),
  customerType: z.enum(CUSTOMER_TYPES).default('residential'),
  source: z.enum(LEAD_SOURCES).default('other'),
  status: z.enum(LEAD_STATUSES).default('new'),
  monthlyBill: money.optional(),
  requiredKw: z.coerce.number().min(0).max(10000).optional(),
  assignedTo: objectId.optional().nullable(),
  followUpAt: optionalDate.nullable(),
  notes: z.string().max(2000).optional().default(''),
  lostReason: z.string().max(300).optional(),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const leadActivitySchema = z.object({
  type: z.enum(['call', 'whatsapp', 'visit', 'email', 'note']),
  note: z.string().trim().min(1).max(2000),
  followUpAt: optionalDate,
});

// ── Projects ──
export const projectSchema = z.object({
  leadId: objectId.optional(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
    address: addressSchema.optional(),
    consumerNumber: z.string().max(40).optional(),
  }),
  customerType: z.enum(CUSTOMER_TYPES).default('residential'),
  connectionType: z.enum(CONNECTION_TYPES).default('on_grid'),
  systemSizeKw: z.coerce.number().min(0).max(10000),
  contractValue: money.default(0),
  expectedSubsidy: money.optional(),
  team: z
    .object({
      salesId: objectId.optional().nullable(),
      managerId: objectId.optional().nullable(),
      engineerId: objectId.optional().nullable(),
      operationsId: objectId.optional().nullable(),
    })
    .optional(),
  targetCompletionDate: optionalDate,
  notes: z.string().max(4000).optional(),
});
export type ProjectInput = z.infer<typeof projectSchema>;
export const projectUpdateSchema = projectSchema.partial().extend({ status: z.enum(PROJECT_STATUSES).optional() });

export const boqSchema = z.object({
  items: z.array(
    z.object({
      itemId: objectId.optional(),
      description: z.string().trim().min(1),
      quantity: z.coerce.number().min(0),
      unit: z.string().default('nos'),
      unitCost: money.default(0),
    }),
  ),
});

export const stageUpdateSchema = z.object({
  status: z.enum(['in_progress', 'blocked', 'completed', 'skipped', 'pending']).optional(),
  checklist: z.array(z.object({ label: z.string(), done: z.boolean() })).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(2000).optional(),
  assigneeId: objectId.optional().nullable(),
  blockedReason: z.string().max(500).optional(),
});
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;

export const commentSchema = z.object({ body: z.string().trim().min(1).max(4000) });

// ── Quotations ──
export const quotationSchema = z.object({
  projectId: objectId.optional(),
  leadId: objectId.optional(),
  kind: z.enum(QUOTATION_KINDS).default('initial'),
  systemSizeKw: z.coerce.number().min(0),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1),
        quantity: z.coerce.number().min(0),
        unitPrice: money,
        gstPercent: z.coerce.number().min(0).max(28).default(12),
        itemId: objectId.optional(),
      }),
    )
    .min(1),
  discount: money.default(0),
  validUntil: optionalDate,
  terms: z.string().max(4000).optional(),
  notes: z.string().max(2000).optional(),
});
export type QuotationInput = z.infer<typeof quotationSchema>;

// ── Documents ──
export const documentMetaSchema = z.object({
  projectId: objectId.optional(),
  leadId: objectId.optional(),
  ticketId: objectId.optional(),
  expenseId: objectId.optional(),
  type: z.enum(DOCUMENT_TYPES),
  stageKey: z.string().optional(),
  note: z.string().max(500).optional(),
});

// ── Inventory ──
export const itemSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  category: z.enum(ITEM_CATEGORIES),
  brand: z.string().max(80).optional(),
  unit: z.string().max(20).default('nos'),
  costPrice: money.default(0),
  sellPrice: money.default(0),
  reorderLevel: z.coerce.number().min(0).default(0),
  gstPercent: z.coerce.number().min(0).max(28).default(12),
  specs: z.string().max(1000).optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const stockMovementSchema = z.object({
  itemId: objectId,
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().positive(),
  unitCost: money.optional(),
  projectId: objectId.optional(),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export const dispatchSchema = z.object({
  projectId: objectId,
  items: z.array(z.object({ itemId: objectId, quantity: z.coerce.number().positive() })).min(1),
  scheduledDate: z.coerce.date(),
  vehicleNo: z.string().max(20).optional(),
  driverName: z.string().max(80).optional(),
  driverPhone: phone.optional(),
  notes: z.string().max(1000).optional(),
});
export const dispatchStatusSchema = z.object({ status: z.enum(DISPATCH_STATUSES), note: z.string().max(500).optional() });

// ── Finance ──
export const paymentSchema = z.object({
  projectId: objectId,
  amount: money.refine((n) => n > 0, 'Amount must be positive'),
  mode: z.enum(PAYMENT_MODES),
  type: z.enum(PAYMENT_TYPES).default('milestone'),
  receivedAt: z.coerce.date().default(() => new Date()),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  projectId: objectId.optional().nullable(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money.refine((n) => n > 0, 'Amount must be positive'),
  description: z.string().trim().min(2).max(500),
  vendor: z.string().max(120).optional(),
  incurredAt: z.coerce.date().default(() => new Date()),
  paidBy: z.enum(['company', 'employee', 'partner']).default('company'),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
export const expenseDecisionSchema = z.object({ status: z.enum(['approved', 'rejected']), note: z.string().max(500).optional() });

export const advanceSchema = z.object({
  personName: z.string().trim().min(1).max(120),
  userId: objectId.optional(),
  kind: z.enum(['employee', 'partner']),
  amount: money.refine((n) => n > 0, 'Amount must be positive'),
  takenAt: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).optional(),
});

// ── Service ──
export const ticketSchema = z.object({
  projectId: objectId,
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(4000),
  category: z.enum(TICKET_CATEGORIES).default('other'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
});
export type TicketInput = z.infer<typeof ticketSchema>;
export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: objectId.optional().nullable(),
  resolution: z.string().max(4000).optional(),
});

export const amcSchema = z.object({
  projectId: objectId,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  visitsPerYear: z.coerce.number().int().min(1).max(52).default(4),
  amount: money.default(0),
  notes: z.string().max(1000).optional(),
});

// ── Common ──
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  sort: z.string().max(40).optional(),
});
