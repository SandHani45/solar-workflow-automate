import { DOCUMENT_TYPES, type DocumentType } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface DocumentDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId?: ObjectId | null;
  leadId?: ObjectId | null;
  ticketId?: ObjectId | null;
  expenseId?: ObjectId | null;
  type: DocumentType;
  stageKey?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<DocumentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', default: null },
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    stageKey: { type: String, default: null },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: String,
  },
  { timestamps: true },
);
documentSchema.index({ orgId: 1, projectId: 1, type: 1 });

export const DocumentModel = model<DocumentDoc>('Document', documentSchema);
