import { Types, type Schema } from 'mongoose';

/** Fields that must never leave the API. */
const SENSITIVE = new Set(['passwordHash', 'sessions', 'tokenHash', 'prevTokenHash', 'inviteTokenHash', 'resetTokenHash', 'storageKey', '__v']);

const isObjectId = (v: unknown): v is Types.ObjectId =>
  v instanceof Types.ObjectId || (typeof v === 'object' && v !== null && (v as { _bsontype?: string })._bsontype === 'ObjectId');

/**
 * Recursively convert Mongo documents / lean objects into API JSON:
 * `_id` → `id` (string), ObjectIds → strings, sensitive fields removed.
 */
export function serialize<T = unknown>(value: unknown): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isObjectId(value)) return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value !== 'object') return value;
  const v = value as Record<string, unknown> & { toObject?: (o?: unknown) => unknown; $__?: unknown };
  if (typeof v.toObject === 'function' && v.$__ !== undefined) return walk(v.toObject({ virtuals: false, versionKey: false, transform: false }));
  if (value instanceof Map) return walk(Object.fromEntries(value));
  if (Buffer.isBuffer(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (SENSITIVE.has(k)) continue;
    if (k === '_id') {
      out.id = isObjectId(val) ? val.toString() : val;
      continue;
    }
    out[k] = walk(val);
  }
  // keep `id` first for readability
  if ('id' in out) return { id: out.id, ...out };
  return out;
}

/** Global mongoose plugin so `doc.toJSON()` follows the same contract. */
export function serializePlugin(schema: Schema): void {
  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => serialize(ret),
  });
}
