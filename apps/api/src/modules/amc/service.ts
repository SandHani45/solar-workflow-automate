import type { z } from 'zod';
import type { amcSchema } from '@solar/shared';
import { isOid, type Ctx } from '../../lib/context';
import { badRequest, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams } from '../../lib/pagination';
import { audit } from '../audit/service';
import { findVisibleProject, scopedProjectFilter } from '../projects/access';
import { USER_REF } from '../users/model';
import { Amc } from './model';

const YEAR_MS = 365.25 * 86_400_000;

/**
 * Spread visits evenly across the contract: n = round(visitsPerYear × years) (≥ 1), one
 * visit at the middle of each of the n equal slices of [startDate, endDate].
 */
export function planVisits(start: Date, end: Date, visitsPerYear: number): Date[] {
  const span = end.getTime() - start.getTime();
  const n = Math.max(1, Math.round((visitsPerYear * span) / YEAR_MS));
  const slice = span / n;
  return Array.from({ length: n }, (_, i) => new Date(start.getTime() + slice * (i + 0.5)));
}

function shape(a: any) {
  const p = a.projectId && a.projectId._id ? a.projectId : null;
  const now = Date.now();
  const visits = (a.visits ?? []).map((v: any) => ({ ...v, overdue: !v.done && new Date(v.dueDate).getTime() < now }));
  const next = visits.find((v: any) => !v.done);
  return {
    ...a,
    projectId: p ? p._id : a.projectId,
    project: p ? { id: p._id, code: p.code, customerName: p.customer?.name } : null,
    status: new Date(a.endDate).getTime() < now ? 'expired' : new Date(a.startDate).getTime() > now ? 'upcoming' : 'active',
    visits,
    visitsDone: visits.filter((v: any) => v.done).length,
    nextVisitAt: next?.dueDate ?? null,
  };
}

const populate = (q: any) => q.populate('projectId', 'code customer.name').populate('visits.doneBy', USER_REF);

export async function listAmc(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'startDate', 'endDate']);
  const filter: Filter = { orgId: ctx.orgOid, ...(await scopedProjectFilter(ctx, query.projectId)) };
  if (query.status === 'active') {
    filter.startDate = { $lte: new Date() };
    filter.endDate = { $gte: new Date() };
  }
  const [rows, total] = await Promise.all([populate(Amc.find(filter).sort(p.sort).skip(p.skip).limit(p.limit)).lean(), Amc.countDocuments(filter)]);
  return { rows: rows.map(shape), meta: pageMeta(p.page, p.limit, total) };
}

export async function createAmc(ctx: Ctx, input: z.infer<typeof amcSchema>) {
  if (input.endDate.getTime() <= input.startDate.getTime()) throw badRequest('endDate must be after startDate');
  const project = await findVisibleProject(ctx, input.projectId);
  const visits = planVisits(input.startDate, input.endDate, input.visitsPerYear).map((dueDate) => ({ dueDate, done: false }));
  const amc = await Amc.create({ ...input, orgId: ctx.orgOid, projectId: project._id, visits, createdBy: ctx.userOid });
  await audit(ctx, { action: 'create', entity: 'amc', entityId: amc._id, projectId: project._id, summary: `Created AMC for ${project.code} with ${visits.length} visits` });
  return shape(await populate(Amc.findById(amc._id)).lean());
}

export async function updateVisit(ctx: Ctx, id: string, visitId: string, input: { done: boolean; note?: string }) {
  if (!isOid(id) || !isOid(visitId)) throw notFound('AMC visit');
  const amc = await Amc.findOne({ _id: id, orgId: ctx.orgOid, ...(await scopedProjectFilter(ctx, undefined)) }).lean();
  const visit = amc?.visits.find((v) => String(v._id) === visitId);
  if (!amc || !visit) throw notFound('AMC visit');
  await Amc.updateOne(
    { _id: amc._id, orgId: ctx.orgOid, 'visits._id': visit._id },
    {
      $set: {
        'visits.$.done': input.done,
        'visits.$.doneAt': input.done ? new Date() : null,
        'visits.$.doneBy': input.done ? ctx.userOid : null,
        ...(input.note !== undefined ? { 'visits.$.note': input.note } : {}),
      },
    },
  );
  await audit(ctx, { action: 'update', entity: 'amc', entityId: amc._id, projectId: amc.projectId, summary: `AMC visit ${visit.dueDate.toISOString().slice(0, 10)} marked ${input.done ? 'done' : 'not done'}` });
  return shape(await populate(Amc.findById(amc._id)).lean());
}
