import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface AuditDoc {
  _id: ObjectId;
  orgId: ObjectId | null;
  userId?: ObjectId | null;
  action: string;
  entity: string;
  entityId?: ObjectId | null;
  projectId?: ObjectId | null;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  createdAt: Date;
}

const auditSchema = new Schema<AuditDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    summary: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ orgId: 1, createdAt: -1 });
auditSchema.index({ orgId: 1, entity: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ orgId: 1, projectId: 1, createdAt: -1 });

export const AuditLog = model<AuditDoc>('AuditLog', auditSchema);
