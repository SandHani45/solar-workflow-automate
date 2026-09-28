import type { AuthContext } from '../../lib/context';
import { oid } from '../../lib/context';
import { logger } from '../../lib/logger';
import type { ObjectId } from '../../lib/mongoose';
import { AuditLog } from './model';

export interface AuditInput {
  action: string; // e.g. create | update | delete | stage.completed
  entity: string; // e.g. project | lead | payment
  entityId?: ObjectId | string | null;
  projectId?: ObjectId | string | null;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

/** Record who changed what. Failures are logged, never surfaced to the caller. */
export async function audit(ctx: Pick<AuthContext, 'orgId' | 'userId'> | null, input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      orgId: ctx?.orgId ? oid(ctx.orgId) : null,
      userId: ctx?.userId ? oid(ctx.userId) : null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ? oid(String(input.entityId)) : null,
      projectId: input.projectId ? oid(String(input.projectId)) : null,
      summary: input.summary.slice(0, 500),
      changes: input.changes && Object.keys(input.changes).length ? input.changes : undefined,
    });
  } catch (err) {
    logger.warn({ err }, 'audit write failed');
  }
}

const norm = (v: unknown): unknown => {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === 'object' && 'toHexString' in (v as object)) return String(v);
  return v;
};

/** Cheap shallow diff of the fields present in `patch`. */
export function diff(before: Record<string, any>, patch: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, to] of Object.entries(patch)) {
    if (to === undefined) continue;
    const from = before?.[k];
    const a = JSON.stringify(norm(from));
    const b = JSON.stringify(norm(to));
    if (a !== b) out[k] = { from: norm(from) ?? null, to: norm(to) };
  }
  return out;
}
