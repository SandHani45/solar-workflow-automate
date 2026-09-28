import { roundMoney } from '@solar/shared';
import { oid } from '../../lib/context';
import type { Filter, ObjectId } from '../../lib/mongoose';
import { Expense } from '../expenses/model';
import { StockMovement } from '../inventory/model';
import { Payment } from '../payments/model';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export const rangeFilter = (field: string, r?: DateRange): Filter => {
  if (!r?.from && !r?.to) return {};
  const f: Record<string, Date> = {};
  if (r.from) f.$gte = r.from;
  if (r.to) f.$lte = r.to;
  return { [field]: f };
};

const idsFilter = (ids?: (ObjectId | string)[] | null): Filter => (ids ? { projectId: { $in: ids.map((i) => oid(String(i))) } } : {});

async function sumByProject(model: any, match: Filter, amountExpr: unknown): Promise<Map<string, number>> {
  const rows: { _id: ObjectId | null; total: number }[] = await model.aggregate([
    { $match: match },
    { $group: { _id: '$projectId', total: { $sum: amountExpr } } },
  ]);
  return new Map(rows.filter((r) => r._id).map((r) => [String(r._id), roundMoney(r.total)]));
}

/** Net money received per project (refunds subtract). Subsidy/loan credits count as received. */
export const signedPaymentAmount = { $cond: [{ $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount'] };

export function receivedByProject(orgId: ObjectId | string, projectIds?: (ObjectId | string)[] | null, range?: DateRange) {
  return sumByProject(Payment, { orgId: oid(String(orgId)), deletedAt: null, ...idsFilter(projectIds), ...rangeFilter('receivedAt', range) }, signedPaymentAmount);
}

export async function projectReceived(orgId: ObjectId | string, projectId: ObjectId | string): Promise<number> {
  return (await receivedByProject(orgId, [projectId])).get(String(projectId)) ?? 0;
}

export async function lastPaymentByProject(orgId: ObjectId | string): Promise<Map<string, Date>> {
  const rows: { _id: ObjectId; at: Date }[] = await Payment.aggregate([
    { $match: { orgId: oid(String(orgId)), deletedAt: null } },
    { $group: { _id: '$projectId', at: { $max: '$receivedAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.at]));
}

/** Approved expenses per project. */
export function expensesByProject(orgId: ObjectId | string, projectIds?: (ObjectId | string)[] | null, range?: DateRange) {
  return sumByProject(Expense, { orgId: oid(String(orgId)), status: 'approved', ...idsFilter(projectIds), ...rangeFilter('incurredAt', range) }, '$amount');
}

/** Material cost per project: stock issued (out) at cost minus returns. */
export function materialCostByProject(orgId: ObjectId | string, projectIds?: (ObjectId | string)[] | null, range?: DateRange) {
  return sumByProject(
    StockMovement,
    { orgId: oid(String(orgId)), type: { $in: ['out', 'return'] }, projectId: { $ne: null }, ...idsFilter(projectIds), ...rangeFilter('createdAt', range) },
    { $multiply: ['$quantity', '$unitCost', { $cond: [{ $eq: ['$type', 'return'] }, -1, 1] }] },
  );
}

export const sumMap = (m: Map<string, number>) => roundMoney([...m.values()].reduce((s, v) => s + v, 0));
