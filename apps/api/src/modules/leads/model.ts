import { CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, type CustomerType, type LeadSource, type LeadStatus } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface Address {
  line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
}

export const addressSchemaDef = {
  line1: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  lat: Number,
  lng: Number,
};

export interface LeadActivity {
  _id: ObjectId;
  type: 'call' | 'whatsapp' | 'visit' | 'email' | 'note';
  note: string;
  by: ObjectId;
  at: Date;
}

export interface LeadDoc {
  _id: ObjectId;
  orgId: ObjectId;
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
  assignedTo?: ObjectId | null;
  followUpAt?: Date | null;
  notes: string;
  lostReason?: string;
  projectId?: ObjectId | null;
  activities: LeadActivity[];
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<LeadDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: addressSchemaDef,
    customerType: { type: String, enum: CUSTOMER_TYPES, default: 'residential' },
    source: { type: String, enum: LEAD_SOURCES, default: 'other' },
    status: { type: String, enum: LEAD_STATUSES, default: 'new' },
    monthlyBill: Number,
    requiredKw: Number,
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    followUpAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    lostReason: String,
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    activities: [
      {
        type: { type: String, enum: ['call', 'whatsapp', 'visit', 'email', 'note'], required: true },
        note: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: () => new Date() },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
leadSchema.index({ orgId: 1, code: 1 }, { unique: true });
leadSchema.index({ orgId: 1, status: 1, createdAt: -1 });
leadSchema.index({ orgId: 1, assignedTo: 1 });

export const Lead = model<LeadDoc>('Lead', leadSchema);
