import type { FeatureDefinition } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface PlatformFeatureDoc extends FeatureDefinition {
  _id: ObjectId;
}

const platformFeatureSchema = new Schema<PlatformFeatureDoc>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    defaultEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const PlatformFeature = model<PlatformFeatureDoc>('PlatformFeature', platformFeatureSchema);
