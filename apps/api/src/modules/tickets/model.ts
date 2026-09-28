import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface TicketDoc {
  _id: ObjectId;
  orgId: ObjectId;
  code: string;
  projectId: ObjectId;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: ObjectId | null;
  raisedBy: ObjectId;
  dueAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  resolution?: string;
  comments: { _id: ObjectId; body: string; by: ObjectId; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<TicketDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    code: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'other' },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'medium' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    resolution: String,
    comments: [{ body: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: () => new Date() } }],
  },
  { timestamps: true },
);
ticketSchema.index({ orgId: 1, code: 1 }, { unique: true });
ticketSchema.index({ orgId: 1, status: 1, priority: 1 });
ticketSchema.index({ orgId: 1, projectId: 1 });
ticketSchema.index({ orgId: 1, assignee: 1 });

export const Ticket = model<TicketDoc>('Ticket', ticketSchema);
