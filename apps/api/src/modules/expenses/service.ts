import { formatINR, roundMoney, type ExpenseInput } from '@solar/shared';
import type { z } from 'zod';
import type { expenseDecisionSchema } from '@solar/shared';
import { can, isOid, oid, sameId, type Ctx } from '../../lib/context';
import { conflict, forbidden, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { audit } from '../audit/service';
import { rangeFilter } from '../finance/calc';
import { notifyUsers, userIdsWithPermission } from '../notifications/service';
import { parseRange } from '../payments/service';
import { findVisibleProject } from '../projects/access';
import { USER_REF } from '../users/model';
import { Expense } from './model';

/** Approvers and finance see all expenses; everyone else (e.g. engineers) only their own. */
function expenseScope(ctx: Ctx): Filter {
  const base: Filter = { orgId: ctx.orgOid };
  if (can(ctx, 'expenses:approve') || can(ctx, 'finance:read')) return base;
  return { ...base, submittedBy: ctx.userOid };
}

function shape(e: any) {
  const project = e.projectId && e.projectId._id ? e.projectId : null;
  return { ...e, projectId: project ? project._id : e.projectId, project: project ? { id: project._id, code: project.code, customerName: project.customer?.name } : null };
}

const populate = (q: any) => q.populate('projectId', 'code customer.name').populate('submittedBy', USER_REF).populate('decidedBy', USER_REF);

export async function listExpenses(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['incurredAt', 'amount', 'createdAt'], '-incurredAt');
  const filter: Filter = { ...expenseScope(ctx), ...rangeFilter('incurredAt', parseRange(query)) };
  if (isOid(query.projectId)) filter.projectId = oid(query.projectId);
  else if (query.projectId === 'none') filter.projectId = null;
  for (const k of ['category', 'status', 'paidBy'] as const) if (typeof query[k] === 'string' && query[k]) filter[k] = query[k];
  if (p.q) filter.$or = [{ description: searchRegex(p.q) }, { vendor: searchRegex(p.q) }];
  const [rows, total, sum] = await Promise.all([
    populate(Expense.find(filter).sort(p.sort).skip(p.skip).limit(p.limit)).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  return { rows: rows.map(shape), meta: { ...pageMeta(p.page, p.limit, total), totalAmount: roundMoney(sum[0]?.total ?? 0) } };
}

export async function createExpense(ctx: Ctx, input: ExpenseInput) {
  const project = input.projectId ? await findVisibleProject(ctx, input.projectId) : null;
  const autoApprove = can(ctx, 'expenses:approve');
  const exp = await Expense.create({
    ...input,
    amount: roundMoney(input.amount),
    orgId: ctx.orgOid,
    projectId: project?._id ?? null,
    status: autoApprove ? 'approved' : 'pending',
    submittedBy: ctx.userOid,
    decidedBy: autoApprove ? ctx.userOid : null,
    decidedAt: autoApprove ? new Date() : null,
  });
  await audit(ctx, {
    action: 'create',
    entity: 'expense',
    entityId: exp._id,
    projectId: project?._id,
    summary: `Recorded ${input.category} expense ${formatINR(exp.amount)}${project ? ` on ${project.code}` : ''} (${exp.status})`,
  });
  if (!autoApprove) {
    const approvers = await userIdsWithPermission(ctx.orgOid, 'expenses:approve');
    await notifyUsers(ctx.orgId, approvers, { title: 'Expense awaiting approval', body: `${ctx.name}: ${formatINR(exp.amount)} · ${input.description}`, link: '/finance/expenses?status=pending' }, ctx.userId);
  }
  return shape(await populate(Expense.findById(exp._id)).lean());
}

export async function decideExpense(ctx: Ctx, id: string, input: z.infer<typeof expenseDecisionSchema>) {
  if (!isOid(id)) throw notFound('Expense');
  const exp = await Expense.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!exp) throw notFound('Expense');
  if (exp.status !== 'pending') throw conflict(`Expense is already ${exp.status}`);
  await Expense.updateOne({ _id: exp._id, orgId: ctx.orgOid }, { $set: { status: input.status, decidedBy: ctx.userOid, decidedAt: new Date(), decisionNote: input.note } });
  await audit(ctx, { action: `expense.${input.status}`, entity: 'expense', entityId: exp._id, projectId: exp.projectId, summary: `${input.status === 'approved' ? 'Approved' : 'Rejected'} expense ${formatINR(exp.amount)} · ${exp.description}`, changes: { status: { from: 'pending', to: input.status } } });
  await notifyUsers(ctx.orgId, [exp.submittedBy], { title: `Expense ${input.status}`, body: `${formatINR(exp.amount)} · ${exp.description}${input.note ? ` — ${input.note}` : ''}`, link: '/finance/expenses' }, ctx.userId);
  return shape(await populate(Expense.findById(exp._id)).lean());
}

export async function deleteExpense(ctx: Ctx, id: string) {
  if (!isOid(id)) throw notFound('Expense');
  const exp = await Expense.findOne({ ...expenseScope(ctx), _id: id }).lean();
  if (!exp) throw notFound('Expense');
  const own = sameId(exp.submittedBy, ctx.userId) && exp.status === 'pending';
  if (!own && !can(ctx, 'expenses:approve')) throw forbidden('You can only delete your own pending expenses');
  await Expense.deleteOne({ _id: exp._id, orgId: ctx.orgOid });
  await audit(ctx, { action: 'delete', entity: 'expense', entityId: exp._id, projectId: exp.projectId, summary: `Deleted expense ${formatINR(exp.amount)} · ${exp.description}` });
  return { ok: true };
}
