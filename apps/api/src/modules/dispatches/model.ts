import { DISPATCH_STATUSES, type DispatchStatus } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface DispatchDoc {
  _id: ObjectId;
  orgId: ObjectId;
  code: string;
  projectId: ObjectId;
  items: { itemId: ObjectId; name: string; sku?: string; unit?: string; quantity: number }[];
  scheduledDate: Date;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  status: DispatchStatus;
  history: { status: DispatchStatus; note?: string; by?: ObjectId; at: Date }[];
  stockIssuedAt?: Date | null;
  stockReturnedAt?: Date | null;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dispatchSchema = new Schema<DispatchDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    code: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    items: [{ _id: false, itemId: { type: Schema.Types.ObjectId, ref: 'Item' }, name: String, sku: String, unit: String, quantity: Number }],
    scheduledDate: { type: Date, required: true },
    vehicleNo: String,
    driverName: String,
    driverPhone: String,
    notes: String,
    status: { type: String, enum: DISPATCH_STATUSES, default: 'planned' },
    history: [{ _id: false, status: String, note: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date }],
    stockIssuedAt: { type: Date, default: null },
    stockReturnedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
dispatchSchema.index({ orgId: 1, code: 1 }, { unique: true });
dispatchSchema.index({ orgId: 1, projectId: 1, status: 1 });

export const Dispatch = model<DispatchDoc>('Dispatch', dispatchSchema);
