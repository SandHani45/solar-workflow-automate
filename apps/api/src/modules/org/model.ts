import type { OrgFeatureMap, OrgPlan, StageDefinition } from '@solar/shared';
import { ORG_PLANS } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface OrgSettings {
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  logoUrl?: string;
  googleReviewUrl?: string;
  advancePercent: number;
  defaultGstPercent: number;
}

export interface OrgPartner {
  name: string;
  sharePercent: number;
  userId?: ObjectId;
}

export interface OrgDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  plan: OrgPlan;
  isActive: boolean;
  settings: OrgSettings;
  features: OrgFeatureMap;
  partners: OrgPartner[];
  workflow: { version: number; stages: StageDefinition[] };
  createdAt: Date;
  updatedAt: Date;
}

const orgSchema = new Schema<OrgDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    plan: { type: String, enum: ORG_PLANS, default: 'starter' },
    isActive: { type: Boolean, default: true },
    settings: {
      phone: String,
      email: String,
      address: String,
      gstin: String,
      logoUrl: String,
      googleReviewUrl: String,
      advancePercent: { type: Number, default: 30 },
      defaultGstPercent: { type: Number, default: 12 },
    },
    // { [featureKey]: { enabled, roles?, lockedByPlatform? } }
    features: { type: Schema.Types.Mixed, default: {} },
    partners: [{ _id: false, name: String, sharePercent: Number, userId: { type: Schema.Types.ObjectId, ref: 'User' } }],
    workflow: {
      version: { type: Number, default: 1 },
      stages: { type: [Schema.Types.Mixed], default: [] },
    },
  },
  { timestamps: true, minimize: false },
);

export const Org = model<OrgDoc>('Org', orgSchema);
