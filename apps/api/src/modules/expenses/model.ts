import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, type ExpenseCategory, type ExpenseStatus } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface ExpenseDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId?: ObjectId | null;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor?: string;
  incurredAt: Date;
  paidBy: 'company' | 'employee' | 'partner';
  status: ExpenseStatus;
  submittedBy: ObjectId;
  decidedBy?: ObjectId | null;
  decidedAt?: Date | null;
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    vendor: String,
    incurredAt: { type: Date, default: () => new Date() },
    paidBy: { type: String, enum: ['company', 'employee', 'partner'], default: 'company' },
    status: { type: String, enum: EXPENSE_STATUSES, default: 'pending' },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: String,
  },
  { timestamps: true },
);
expenseSchema.index({ orgId: 1, projectId: 1, status: 1 });
expenseSchema.index({ orgId: 1, incurredAt: -1 });

export const Expense = model<ExpenseDoc>('Expense', expenseSchema);
