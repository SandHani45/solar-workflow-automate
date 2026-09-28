import { PAYMENT_MODES, PAYMENT_TYPES, type PaymentMode, type PaymentType } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface PaymentDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId: ObjectId;
  receiptNo: string;
  amount: number;
  mode: PaymentMode;
  type: PaymentType;
  receivedAt: Date;
  reference?: string;
  note?: string;
  recordedBy?: ObjectId;
  deletedAt?: Date | null;
  deletedBy?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    receiptNo: { type: String, required: true },
    amount: { type: Number, required: true },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    type: { type: String, enum: PAYMENT_TYPES, default: 'milestone' },
    receivedAt: { type: Date, default: () => new Date() },
    reference: String,
    note: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ orgId: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ orgId: 1, projectId: 1, deletedAt: 1 });
paymentSchema.index({ orgId: 1, receivedAt: -1 });

export const Payment = model<PaymentDoc>('Payment', paymentSchema);
