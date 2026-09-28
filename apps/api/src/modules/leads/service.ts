import { LEAD_STATUSES, type LeadInput } from '@solar/shared';
import type { z } from 'zod';
import type { leadActivitySchema, leadSchema } from '@solar/shared';
import { can, isOid, oid, sameId, type Ctx } from '../../lib/context';
import { conflict, forbidden, notFound, badRequest } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { audit, diff } from '../audit/service';
import { notifyUsers } from '../notifications/service';
import { createProject } from '../projects/service';
import { User, USER_REF } from '../users/model';
import { Lead, type LeadDoc } from './model';

/** Users without `leads:assign` only see leads assigned to (or created by) them. */
export function leadScope(ctx: Ctx): Filter {
  const base: Filter = { orgId: ctx.orgOid };
  if (can(ctx, 'leads:assign')) return base;
  return { ...base, $or: [{ assignedTo: ctx.userOid }, { createdBy: ctx.userOid }] };
}

const POPULATE = [
  { path: 'assignedTo', select: USER_REF },
  { path: 'activities.by', select: USER_REF },
];

async function findLead(ctx: Ctx, id: string): Promise<LeadDoc> {
  if (!isOid(id)) throw notFound('Lead');
  const lead = await Lead.findOne({ ...leadScope(ctx), _id: id }).lean();
  if (!lead) throw notFound('Lead');
  return lead;
}

async function resolveAssignee(ctx: Ctx, assignedTo: string | null | undefined, current?: unknown) {
  if (assignedTo === undefined) return undefined;
  if (assignedTo !== null && !sameId(assignedTo, current) && !sameId(assignedTo, ctx.userId) && !can(ctx, 'leads:assign')) {
    throw forbidden('Assigning leads to others requires the leads:assign permission');
  }
  if (assignedTo && !(await User.exists({ _id: assignedTo, orgId: ctx.orgOid, isActive: true }))) throw badRequest('assignedTo must be an active user in your organisation');
  return assignedTo ? oid(assignedTo) : null;
}

export async function listLeads(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'updatedAt', 'name', 'followUpAt', 'code', 'status']);
  const filter: Filter = leadScope(ctx);
  for (const k of ['status', 'source'] as const) if (typeof query[k] === 'string' && query[k]) filter[k] = query[k];
  if (isOid(query.assignedTo)) filter.assignedTo = oid(query.assignedTo);
  else if (query.assignedTo === 'none') filter.assignedTo = null;
  if (p.q) {
    const rx = searchRegex(p.q);
    filter.$and = [{ $or: [{ name: rx }, { phone: rx }, { code: rx }, { email: rx }] }];
  }
  const [rows, total] = await Promise.all([
    Lead.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate(POPULATE).lean(),
    Lead.countDocuments(filter),
  ]);
  return { rows, meta: pageMeta(p.page, p.limit, total) };
}

export async function leadBoard(ctx: Ctx) {
  const rows = await Lead.find(leadScope(ctx)).select('-activities').sort({ updatedAt: -1 }).limit(1000).populate('assignedTo', USER_REF).lean();
  const board: Record<string, unknown[]> = Object.fromEntries(LEAD_STATUSES.map((s) => [s, []]));
  for (const r of rows) board[r.status]!.push(r);
  return board;
}

export async function getLead(ctx: Ctx, id: string) {
  const lead = await findLead(ctx, id);
  return Lead.findById(lead._id).populate(POPULATE).lean();
}

export async function createLead(ctx: Ctx, input: LeadInput) {
  const assignedTo = can(ctx, 'leads:assign') ? await resolveAssignee(ctx, input.assignedTo) : ctx.userOid;
  if (!can(ctx, 'leads:assign') && input.assignedTo && !sameId(input.assignedTo, ctx.userId)) throw forbidden('Assigning leads to others requires the leads:assign permission');
  const lead = await Lead.create({
    ...input,
    orgId: ctx.orgOid,
    code: await nextCode(ctx.orgOid, 'lead'),
    assignedTo: assignedTo ?? null,
    createdBy: ctx.userOid,
    activities: [],
  });
  await audit(ctx, { action: 'create', entity: 'lead', entityId: lead._id, summary: `Created lead ${lead.code} · ${lead.name}` });
  if (assignedTo && !sameId(assignedTo, ctx.userId)) {
    await notifyUsers(ctx.orgId, [assignedTo], { title: 'New lead assigned', body: `${lead.code} · ${lead.name}`, link: `/leads/${lead._id}` });
  }
  return getLead(ctx, String(lead._id));
}

export async function updateLead(ctx: Ctx, id: string, input: Partial<z.infer<typeof leadSchema>>) {
  const before = await findLead(ctx, id);
  const patch: Record<string, unknown> = { ...input };
  if (input.assignedTo !== undefined) patch.assignedTo = await resolveAssignee(ctx, input.assignedTo, before.assignedTo);
  if (input.status === 'lost' && !input.lostReason && !before.lostReason) throw badRequest('lostReason is required when marking a lead as lost');
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
  await Lead.updateOne({ _id: before._id, orgId: ctx.orgOid }, { $set: patch });
  await audit(ctx, { action: 'update', entity: 'lead', entityId: before._id, summary: `Updated lead ${before.code}`, changes: diff(before as any, patch) });
  if (patch.assignedTo && !sameId(patch.assignedTo, before.assignedTo) && !sameId(patch.assignedTo, ctx.userId)) {
    await notifyUsers(ctx.orgId, [String(patch.assignedTo)], { title: 'Lead assigned to you', body: `${before.code} · ${before.name}`, link: `/leads/${before._id}` });
  }
  return getLead(ctx, id);
}

export async function deleteLead(ctx: Ctx, id: string) {
  const lead = await findLead(ctx, id);
  if (lead.projectId) throw conflict('This lead has been converted to a project and cannot be deleted');
  await Lead.deleteOne({ _id: lead._id, orgId: ctx.orgOid });
  await audit(ctx, { action: 'delete', entity: 'lead', entityId: lead._id, summary: `Deleted lead ${lead.code} · ${lead.name}` });
  return { ok: true };
}

export async function addActivity(ctx: Ctx, id: string, input: z.infer<typeof leadActivitySchema>) {
  const lead = await findLead(ctx, id);
  const $set: Record<string, unknown> = {};
  if (input.followUpAt) $set.followUpAt = input.followUpAt;
  if (lead.status === 'new' && input.type !== 'note') $set.status = 'contacted';
  await Lead.updateOne(
    { _id: lead._id, orgId: ctx.orgOid },
    { $push: { activities: { type: input.type, note: input.note, by: ctx.userOid, at: new Date() } }, ...(Object.keys($set).length ? { $set } : {}) },
  );
  await audit(ctx, { action: 'activity', entity: 'lead', entityId: lead._id, summary: `${input.type} on lead ${lead.code}: ${input.note.slice(0, 80)}` });
  return getLead(ctx, id);
}

export async function convertLead(ctx: Ctx, id: string, input: { systemSizeKw: number; contractValue?: number }) {
  const lead = await findLead(ctx, id);
  if (lead.projectId) throw conflict(`Lead ${lead.code} is already converted`);
  const project = await createProject(ctx, {
    leadId: String(lead._id),
    customer: { name: lead.name, phone: lead.phone, email: lead.email || '', address: lead.address as any },
    customerType: lead.customerType,
    connectionType: 'on_grid',
    systemSizeKw: input.systemSizeKw,
    contractValue: input.contractValue ?? 0,
    team: lead.assignedTo ? { salesId: String(lead.assignedTo) } : undefined,
  });
  await Lead.updateOne({ _id: lead._id, orgId: ctx.orgOid }, { $set: { status: 'won', projectId: oid(String((project as any)._id)) } });
  await audit(ctx, { action: 'convert', entity: 'lead', entityId: lead._id, projectId: (project as any)._id, summary: `Converted lead ${lead.code} to project ${(project as any).code}` });
  return project;
}
