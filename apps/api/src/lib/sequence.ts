import { Schema, Types, model, type ObjectId } from './mongoose';

/** Atomic per-org counters used for human-readable codes (L-00001, SP-2026-0001, …). */
const counterSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Org', required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false },
);
counterSchema.index({ orgId: 1, key: 1 }, { unique: true });

export const Counter = model('Counter', counterSchema);

export async function nextSeq(orgId: ObjectId | string, key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { orgId: new Types.ObjectId(String(orgId)), key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

export type SequenceKind = 'lead' | 'project' | 'quotation' | 'receipt' | 'dispatch' | 'ticket';

/**
 * Next code for an entity:
 * lead `L-00001`, project `SP-2026-0001`, quotation `Q-2026-0001`, receipt `R-2026-0001`,
 * dispatch `D-0001`, ticket `T-0001`. Year-scoped sequences restart every year.
 */
export async function nextCode(orgId: ObjectId | string, kind: SequenceKind, date = new Date()): Promise<string> {
  const year = date.getFullYear();
  switch (kind) {
    case 'lead':
      return `L-${pad(await nextSeq(orgId, 'lead'), 5)}`;
    case 'project':
      return `SP-${year}-${pad(await nextSeq(orgId, `project:${year}`), 4)}`;
    case 'quotation':
      return `Q-${year}-${pad(await nextSeq(orgId, `quotation:${year}`), 4)}`;
    case 'receipt':
      return `R-${year}-${pad(await nextSeq(orgId, `receipt:${year}`), 4)}`;
    case 'dispatch':
      return `D-${pad(await nextSeq(orgId, 'dispatch'), 4)}`;
    case 'ticket':
      return `T-${pad(await nextSeq(orgId, 'ticket'), 4)}`;
  }
}
