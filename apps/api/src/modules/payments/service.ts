import { formatINR, roundMoney, type PaymentInput } from '@solar/shared';
import { isOid, type Ctx } from '../../lib/context';
import { notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { audit } from '../audit/service';
import { rangeFilter } from '../finance/calc';
import { notifyUsers } from '../notifications/service';
import { findVisibleProject, scopedProjectFilter } from '../projects/access';
import { USER_REF } from '../users/model';
import { Payment } from './model';

export const parseDate = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** `to=YYYY-MM-DD` is inclusive of that whole day. */
export const parseRange = (query: Record<string, unknown>) => {
  const from = parseDate(query.from);
  let to = parseDate(query.to);
  if (to && typeof query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to = new Date(to.getTime() + 86_399_999);
  return { from, to };
};

function shape(p: any) {
  const project = p.projectId && p.projectId._id ? p.projectId : null;
  return { ...p, projectId: project ? project._id : p.projectId, project: project ? { id: project._id, code: project.code, customerName: project.customer?.name } : null };
}

export async function listPayments(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['receivedAt', 'amount', 'createdAt'], '-receivedAt');
  const filter: Filter = { orgId: ctx.orgOid, deletedAt: null, ...(await scopedProjectFilter(ctx, query.projectId)), ...rangeFilter('receivedAt', parseRange(query)) };
  for (const k of ['mode', 'type'] as const) if (typeof query[k] === 'string' && query[k]) filter[k] = query[k];
  if (p.q) filter.$or = [{ receiptNo: searchRegex(p.q) }, { reference: searchRegex(p.q) }];
  const [rows, total, sum] = await Promise.all([
    Payment.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('projectId', 'code customer.name').populate('recordedBy', USER_REF).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount'] } } } }]),
  ]);
  return { rows: rows.map(shape), meta: { ...pageMeta(p.page, p.limit, total), totalAmount: roundMoney(sum[0]?.total ?? 0) } };
}

export async function createPayment(ctx: Ctx, input: PaymentInput) {
  const project = await findVisibleProject(ctx, input.projectId);
  const payment = await Payment.create({
    ...input,
    amount: roundMoney(input.amount),
    orgId: ctx.orgOid,
    projectId: project._id,
    receiptNo: await nextCode(ctx.orgOid, 'receipt', input.receivedAt),
    recordedBy: ctx.userOid,
  });
  await audit(ctx, {
    action: 'create',
    entity: 'payment',
    entityId: payment._id,
    projectId: project._id,
    summary: `${input.type === 'refund' ? 'Refunded' : 'Received'} ${formatINR(payment.amount)} via ${input.mode} on ${project.code} (${payment.receiptNo})`,
  });
  if (project.customerUserId && input.type !== 'refund') {
    await notifyUsers(ctx.orgId, [project.customerUserId], { title: 'Payment received', body: `${formatINR(payment.amount)} received · receipt ${payment.receiptNo}`, link: `/portal/projects/${project._id}` });
  }
  return shape(await Payment.findById(payment._id).populate('projectId', 'code customer.name').populate('recordedBy', USER_REF).lean());
}

export async function deletePayment(ctx: Ctx, id: string) {
  if (!isOid(id)) throw notFound('Payment');
  const payment = await Payment.findOne({ _id: id, orgId: ctx.orgOid, deletedAt: null, ...(await scopedProjectFilter(ctx, undefined)) }).lean();
  if (!payment) throw notFound('Payment');
  await Payment.updateOne({ _id: payment._id, orgId: ctx.orgOid }, { $set: { deletedAt: new Date(), deletedBy: ctx.userOid } });
  await audit(ctx, { action: 'delete', entity: 'payment', entityId: payment._id, projectId: payment.projectId, summary: `Deleted payment ${payment.receiptNo} of ${formatINR(payment.amount)}` });
  return { ok: true };
}
