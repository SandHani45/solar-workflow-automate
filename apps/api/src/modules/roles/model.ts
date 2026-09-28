import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface RoleDoc {
  _id: ObjectId;
  orgId: ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);
roleSchema.index({ orgId: 1, key: 1 }, { unique: true });

export const Role = model<RoleDoc>('Role', roleSchema);
