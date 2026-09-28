import { formatINR, roundMoney } from '@solar/shared';
import type { z } from 'zod';
import type { advanceSchema } from '@solar/shared';
import { isOid, oid, type Ctx } from '../../lib/context';
import { badRequest, conflict, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { audit } from '../audit/service';
import { User, USER_REF } from '../users/model';
import { Advance } from './model';

export async function listAdvances(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['takenAt', 'amount', 'createdAt'], '-takenAt');
  const filter: Filter = { orgId: ctx.orgOid };
  for (const k of ['kind', 'status'] as const) if (typeof query[k] === 'string' && query[k]) filter[k] = query[k];
  if (p.q) filter.personName = searchRegex(p.q);
  const [rows, total, outstanding] = await Promise.all([
    Advance.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('userId', USER_REF).populate('settledBy', USER_REF).lean(),
    Advance.countDocuments(filter),
    Advance.aggregate([{ $match: { orgId: ctx.orgOid, status: 'outstanding' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const data = rows.map(({ userId, ...r }: any) => ({ ...r, userId: userId?._id ?? userId ?? null, user: userId && userId._id ? userId : null }));
  return { rows: data, meta: { ...pageMeta(p.page, p.limit, total), outstanding: roundMoney(outstanding[0]?.total ?? 0) } };
}

export async function createAdvance(ctx: Ctx, input: z.infer<typeof advanceSchema>) {
  if (input.userId && !(await User.exists({ _id: input.userId, orgId: ctx.orgOid }))) throw badRequest('userId must be a user in your organisation');
  const adv = await Advance.create({ ...input, amount: roundMoney(input.amount), userId: input.userId ? oid(input.userId) : null, orgId: ctx.orgOid, status: 'outstanding', createdBy: ctx.userOid });
  await audit(ctx, { action: 'create', entity: 'advance', entityId: adv._id, summary: `${input.kind === 'partner' ? 'Partner' : 'Employee'} advance ${formatINR(adv.amount)} to ${adv.personName}` });
  return adv.toObject();
}

export async function settleAdvance(ctx: Ctx, id: string) {
  if (!isOid(id)) throw notFound('Advance');
  const adv = await Advance.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!adv) throw notFound('Advance');
  if (adv.status === 'settled') throw conflict('Advance is already settled');
  const updated = await Advance.findOneAndUpdate({ _id: adv._id, orgId: ctx.orgOid }, { $set: { status: 'settled', settledAt: new Date(), settledBy: ctx.userOid } }, { returnDocument: 'after' }).lean();
  await audit(ctx, { action: 'advance.settled', entity: 'advance', entityId: adv._id, summary: `Settled advance ${formatINR(adv.amount)} of ${adv.personName}` });
  return updated;
}
