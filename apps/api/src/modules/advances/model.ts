import { ADVANCE_STATUSES, type AdvanceStatus } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface AdvanceDoc {
  _id: ObjectId;
  orgId: ObjectId;
  personName: string;
  userId?: ObjectId | null;
  kind: 'employee' | 'partner';
  amount: number;
  takenAt: Date;
  note?: string;
  status: AdvanceStatus;
  settledAt?: Date | null;
  settledBy?: ObjectId | null;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const advanceSchema = new Schema<AdvanceDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    personName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    kind: { type: String, enum: ['employee', 'partner'], required: true },
    amount: { type: Number, required: true },
    takenAt: { type: Date, default: () => new Date() },
    note: String,
    status: { type: String, enum: ADVANCE_STATUSES, default: 'outstanding' },
    settledAt: { type: Date, default: null },
    settledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
advanceSchema.index({ orgId: 1, status: 1 });

export const Advance = model<AdvanceDoc>('Advance', advanceSchema);
