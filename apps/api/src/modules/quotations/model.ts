import { QUOTATION_KINDS, QUOTATION_STATUSES, type QuotationKind, type QuotationStatus } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface QuotationDoc {
  _id: ObjectId;
  orgId: ObjectId;
  number: string;
  projectId?: ObjectId | null;
  leadId?: ObjectId | null;
  kind: QuotationKind;
  version: number;
  status: QuotationStatus;
  systemSizeKw: number;
  lines: { description: string; quantity: number; unitPrice: number; gstPercent: number; itemId?: ObjectId }[];
  subtotal: number;
  gstTotal: number;
  discount: number;
  grandTotal: number;
  validUntil?: Date | null;
  terms?: string;
  notes?: string;
  createdBy?: ObjectId;
  sentAt?: Date | null;
  decidedAt?: Date | null;
  decidedBy?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new Schema<QuotationDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    number: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    kind: { type: String, enum: QUOTATION_KINDS, default: 'initial' },
    version: { type: Number, default: 1 },
    status: { type: String, enum: QUOTATION_STATUSES, default: 'draft' },
    systemSizeKw: { type: Number, default: 0 },
    lines: [
      {
        _id: false,
        description: String,
        quantity: Number,
        unitPrice: Number,
        gstPercent: Number,
        itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      },
    ],
    subtotal: Number,
    gstTotal: Number,
    discount: { type: Number, default: 0 },
    grandTotal: Number,
    validUntil: { type: Date, default: null },
    terms: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
quotationSchema.index({ orgId: 1, number: 1 }, { unique: true });
quotationSchema.index({ orgId: 1, projectId: 1, version: -1 });
quotationSchema.index({ orgId: 1, leadId: 1, version: -1 });

export const Quotation = model<QuotationDoc>('Quotation', quotationSchema);
