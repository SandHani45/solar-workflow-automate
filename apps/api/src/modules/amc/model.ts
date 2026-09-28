import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface AmcVisit {
  _id: ObjectId;
  dueDate: Date;
  done: boolean;
  doneAt?: Date | null;
  doneBy?: ObjectId | null;
  note?: string;
}

export interface AmcDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId: ObjectId;
  startDate: Date;
  endDate: Date;
  visitsPerYear: number;
  amount: number;
  notes?: string;
  visits: AmcVisit[];
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const amcSchema = new Schema<AmcDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    visitsPerYear: { type: Number, default: 4 },
    amount: { type: Number, default: 0 },
    notes: String,
    visits: [
      {
        dueDate: { type: Date, required: true },
        done: { type: Boolean, default: false },
        doneAt: { type: Date, default: null },
        doneBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        note: String,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
amcSchema.index({ orgId: 1, projectId: 1 });

export const Amc = model<AmcDoc>('Amc', amcSchema);
