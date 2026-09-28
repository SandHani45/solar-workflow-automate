import {
  CONNECTION_TYPES,
  CUSTOMER_TYPES,
  LOAN_STATUSES,
  NET_METERING_STATUSES,
  PROJECT_STATUSES,
  STAGE_STATUSES,
  SUBSIDY_STATUSES,
  type ConnectionType,
  type CustomerType,
  type LoanStatus,
  type NetMeteringStatus,
  type PhaseKey,
  type ProjectStatus,
  type StageDefinition,
  type StageStatus,
  type SubsidyStatus,
} from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';
import { addressSchemaDef, type Address } from '../leads/model';

export interface StageNote {
  body: string;
  by: ObjectId;
  at: Date;
}

export interface StageState {
  key: string;
  status: StageStatus;
  assignee?: ObjectId | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  completedBy?: ObjectId | null;
  dueAt?: Date | null;
  checklist: { label: string; done: boolean }[];
  data: Record<string, unknown>;
  notes: StageNote[];
  blockedReason?: string | null;
  /** Set when the engine skipped the stage because its feature (or the stage) is disabled. */
  autoSkipped?: boolean;
}

export interface BoqLine {
  itemId?: ObjectId | null;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface ProjectDoc {
  _id: ObjectId;
  orgId: ObjectId;
  code: string;
  status: ProjectStatus;
  customer: { name: string; phone: string; email?: string; address?: Address; consumerNumber?: string };
  customerType: CustomerType;
  connectionType: ConnectionType;
  systemSizeKw: number;
  contractValue: number;
  expectedSubsidy?: number;
  team: { sales?: ObjectId | null; manager?: ObjectId | null; engineer?: ObjectId | null; operations?: ObjectId | null };
  customerUserId?: ObjectId | null;
  leadId?: ObjectId | null;
  workflowVersion: number;
  stageDefinitions: StageDefinition[];
  stages: StageState[];
  currentPhase: PhaseKey;
  progress: number;
  boq: BoqLine[];
  /** True once BOQ stock is reserved (automation `reserve_boq_stock`). */
  boqReserved: boolean;
  survey?: { roofType?: string; floors?: number; shadowFreeAreaSqft?: number; sanctionedLoadKw?: number; surveyDate?: Date; notes?: string } | null;
  subsidy: { status: SubsidyStatus; applicationNo?: string; amount?: number };
  loan: { status: LoanStatus; bank?: string; amount?: number };
  netMetering: { status: NetMeteringStatus; applicationNo?: string; meterNumber?: string; inspectionDate?: Date };
  installationDate?: Date | null;
  targetCompletionDate?: Date | null;
  completedAt?: Date | null;
  rating?: number | null;
  reviewRequestedAt?: Date | null;
  notes?: string;
  createdBy?: ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const stageSchema = new Schema<StageState>(
  {
    key: { type: String, required: true },
    status: { type: String, enum: STAGE_STATUSES, default: 'locked' },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },
    checklist: [{ _id: false, label: String, done: { type: Boolean, default: false } }],
    data: { type: Schema.Types.Mixed, default: {} },
    notes: [{ _id: false, body: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: () => new Date() } }],
    blockedReason: { type: String, default: null },
    autoSkipped: { type: Boolean, default: false },
  },
  { _id: false, minimize: false },
);

const projectSchema = new Schema<ProjectDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    code: { type: String, required: true },
    status: { type: String, enum: PROJECT_STATUSES, default: 'active' },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      address: addressSchemaDef,
      consumerNumber: { type: String, default: '' },
    },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: 'residential' },
    connectionType: { type: String, enum: CONNECTION_TYPES, default: 'on_grid' },
    systemSizeKw: { type: Number, default: 0 },
    contractValue: { type: Number, default: 0 },
    expectedSubsidy: Number,
    team: {
      sales: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      manager: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      engineer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      operations: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    workflowVersion: { type: Number, default: 1 },
    stageDefinitions: { type: [Schema.Types.Mixed] as any, default: [] },
    stages: { type: [stageSchema], default: [] },
    currentPhase: { type: String, default: 'sales' },
    progress: { type: Number, default: 0 },
    boq: [
      {
        _id: false,
        itemId: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
        description: String,
        quantity: Number,
        unit: { type: String, default: 'nos' },
        unitCost: { type: Number, default: 0 },
      },
    ],
    boqReserved: { type: Boolean, default: false },
    survey: {
      type: new Schema(
        { roofType: String, floors: Number, shadowFreeAreaSqft: Number, sanctionedLoadKw: Number, surveyDate: Date, notes: String },
        { _id: false },
      ),
      default: null,
    },
    subsidy: {
      status: { type: String, enum: SUBSIDY_STATUSES, default: 'not_applied' },
      applicationNo: String,
      amount: Number,
    },
    loan: {
      status: { type: String, enum: LOAN_STATUSES, default: 'not_required' },
      bank: String,
      amount: Number,
    },
    netMetering: {
      status: { type: String, enum: NET_METERING_STATUSES, default: 'not_started' },
      applicationNo: String,
      meterNumber: String,
      inspectionDate: Date,
    },
    installationDate: { type: Date, default: null },
    targetCompletionDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    rating: { type: Number, default: null },
    reviewRequestedAt: { type: Date, default: null },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
projectSchema.index({ orgId: 1, code: 1 }, { unique: true });
projectSchema.index({ orgId: 1, status: 1, currentPhase: 1 });
projectSchema.index({ orgId: 1, 'team.engineer': 1 });
projectSchema.index({ orgId: 1, customerUserId: 1 });
projectSchema.index({ orgId: 1, deletedAt: 1, createdAt: -1 });

export const Project = model<ProjectDoc>('Project', projectSchema);

export interface CommentDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId: ObjectId;
  body: string;
  by: ObjectId;
  createdAt: Date;
}

const commentSchema = new Schema<CommentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    body: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
commentSchema.index({ orgId: 1, projectId: 1, createdAt: 1 });

export const ProjectComment = model<CommentDoc>('ProjectComment', commentSchema);
