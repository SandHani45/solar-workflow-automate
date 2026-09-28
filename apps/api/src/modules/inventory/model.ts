import { ITEM_CATEGORIES, STOCK_MOVEMENT_TYPES, type ItemCategory, type StockMovementType } from '@solar/shared';
import { Schema, model, type ObjectId } from '../../lib/mongoose';

export interface ItemDoc {
  _id: ObjectId;
  orgId: ObjectId;
  sku: string;
  name: string;
  category: ItemCategory;
  brand?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  gstPercent: number;
  specs?: string;
  quantity: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ItemDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    category: { type: String, enum: ITEM_CATEGORIES, required: true },
    brand: String,
    unit: { type: String, default: 'nos' },
    costPrice: { type: Number, default: 0 },
    sellPrice: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 12 },
    specs: String,
    quantity: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
itemSchema.index({ orgId: 1, sku: 1 }, { unique: true });
itemSchema.index({ orgId: 1, category: 1 });

export const Item = model<ItemDoc>('Item', itemSchema);

export interface MovementDoc {
  _id: ObjectId;
  orgId: ObjectId;
  itemId: ObjectId;
  type: StockMovementType;
  quantity: number;
  unitCost: number;
  projectId?: ObjectId | null;
  dispatchId?: ObjectId | null;
  reference?: string;
  note?: string;
  balanceAfter: number;
  by?: ObjectId | null;
  createdAt: Date;
}

const movementSchema = new Schema<MovementDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    // Signed for `adjust` (negative = write-off); always positive for in/out/return.
    quantity: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    dispatchId: { type: Schema.Types.ObjectId, ref: 'Dispatch', default: null },
    reference: String,
    note: String,
    balanceAfter: { type: Number, default: 0 },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
movementSchema.index({ orgId: 1, itemId: 1, createdAt: -1 });
movementSchema.index({ orgId: 1, projectId: 1, type: 1 });
movementSchema.index({ orgId: 1, dispatchId: 1, itemId: 1, type: 1 });

export const StockMovement = model<MovementDoc>('StockMovement', movementSchema);
