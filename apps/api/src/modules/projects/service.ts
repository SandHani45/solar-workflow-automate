import { PHASES, roundMoney, type ProjectInput } from '@solar/shared';
import type { z } from 'zod';
import type { boqSchema, projectUpdateSchema } from '@solar/shared';
import { env } from '../../config/env';
import { can, isOid, oid, sameId, type Ctx } from '../../lib/context';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import type { Filter, ObjectId } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { AuditLog } from '../audit/model';
import { audit, diff } from '../audit/service';
import { createInvite } from '../auth/service';
import { DocumentModel } from '../documents/model';
import { Expense } from '../expenses/model';
import { expensesByProject, materialCostByProject, receivedByProject } from '../finance/calc';
import { Item } from '../inventory/model';
import { Lead } from '../leads/model';
import { getOrgOrThrow } from '../org/service';
import { Payment } from '../payments/model';
import { notifyUsers } from '../notifications/service';
import { logger } from '../../lib/logger';
import { User, USER_REF } from '../users/model';
import { findVisibleProject, projectScope } from './access';
import { Project, ProjectComment, type ProjectDoc } from './model';
import { initialiseProjectStages, notifyStageOwners, syncProjectFeatures } from './workflow.service';

type TeamInput = NonNullable<ProjectInput['team']>;
const TEAM_SLOTS = ['sales', 'manager', 'engineer', 'operations'] as const;

const POPULATE = [
  { path: 'team.sales', select: USER_REF },
  { path: 'team.manager', select: USER_REF },
  { path: 'team.engineer', select: USER_REF },
  { path: 'team.operations', select: USER_REF },
  { path: 'stages.assignee', select: USER_REF },
  { path: 'stages.completedBy', select: USER_REF },
  { path: 'stages.notes.by', select: USER_REF },
];

async function resolveTeam(ctx: Ctx, team: TeamInput | undefined) {
  const out: Record<string, ObjectId | null> = {};
  if (!team) return out;
  for (const slot of TEAM_SLOTS) {
    const id = team[`${slot}Id` as keyof TeamInput];
    if (id === undefined) continue;
    if (id === null) {
      out[slot] = null;
      continue;
    }
    if (!(await User.exists({ _id: id, orgId: ctx.orgOid, isActive: true }))) throw badRequest(`team.${slot}Id must be an active user in your organisation`);
    out[slot] = oid(id);
  }
  return out;
}

/** Counts + money summary attached to list and detail payloads. */
async function extrasFor(ctx: Ctx, projects: Pick<ProjectDoc, '_id' | 'contractValue'>[]) {
  const ids = projects.map((p) => p._id);
  const [docCounts, received] = await Promise.all([
    DocumentModel.aggregate<{ _id: ObjectId; n: number }>([{ $match: { orgId: ctx.orgOid, projectId: { $in: ids } } }, { $group: { _id: '$projectId', n: { $sum: 1 } } }]),
    can(ctx, 'payments:read') ? receivedByProject(ctx.orgOid, ids) : Promise.resolve(null),
  ]);
  const counts = new Map(docCounts.map((d) => [String(d._id), d.n]));
  return (p: Pick<ProjectDoc, '_id' | 'contractValue'>) => {
    const r = received?.get(String(p._id)) ?? 0;
    return {
      documentsCount: counts.get(String(p._id)) ?? 0,
      ...(received ? { financialSummary: { received: r, pending: roundMoney(Math.max(0, (p.contractValue ?? 0) - r)) } } : {}),
    };
  };
}

function activeStages(p: ProjectDoc) {
  return p.stages
    .filter((s) => ['pending', 'in_progress', 'blocked'].includes(s.status))
    .map((s) => {
      const def = p.stageDefinitions?.find((d) => d.key === s.key);
      return { key: s.key, name: def?.name ?? s.key, phase: def?.phase, status: s.status, dueAt: s.dueAt, overdue: !!s.dueAt && s.dueAt.getTime() < Date.now() };
    });
}

/** Summary shape used by lists/boards: no workflow snapshot, adds `activeStages`. */
function summaryOf(p: any, extra: Record<string, unknown>) {
  const { stageDefinitions: _defs, stages: _stages, ...rest } = p;
  return { ...rest, activeStages: activeStages(p), ...extra };
}

export async function listProjects(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'updatedAt', 'code', 'contractValue', 'progress', 'installationDate']);
  const filter: Filter = projectScope(ctx);
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (typeof query.phase === 'string' && query.phase) filter.currentPhase = query.phase;
  if (typeof query.stageKey === 'string' && query.stageKey)
    filter.stages = { $elemMatch: { key: query.stageKey, status: { $in: ['pending', 'in_progress', 'blocked'] } } };
  if (isOid(query.engineerId)) filter['team.engineer'] = oid(query.engineerId);
  if (p.q) {
    const rx = searchRegex(p.q);
    const or = [{ code: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
    filter.$and = [...(filter.$and ?? []), { $or: or }];
  }
  const [rows, total] = await Promise.all([
    Project.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate(POPULATE).lean(),
    Project.countDocuments(filter),
  ]);
  const extra = await extrasFor(ctx, rows);
  return { rows: rows.map((r) => ({ ...r, activeStages: activeStages(r as unknown as ProjectDoc), ...extra(r) })), meta: pageMeta(p.page, p.limit, total) };
}

export async function projectBoard(ctx: Ctx) {
  const rows = await Project.find({ ...projectScope(ctx), status: { $in: ['active', 'on_hold'] } })
    .sort({ updatedAt: -1 })
    .limit(500)
    .populate(POPULATE.slice(0, 4))
    .lean();
  const extra = await extrasFor(ctx, rows);
  const board: Record<string, unknown[]> = Object.fromEntries(PHASES.map((ph) => [ph.key, []]));
  for (const r of rows) (board[r.currentPhase] ??= []).push(summaryOf(r, extra(r)));
  return board;
}

export async function getProjectDetail(ctx: Ctx, id: string) {
  const found = await findVisibleProject(ctx, id);
  await syncProjectFeatures(found);
  const p = await Project.findOne({ _id: found._id, orgId: ctx.orgOid }).populate(POPULATE).lean();
  if (!p) throw notFound('Project');
  const extra = await extrasFor(ctx, [p]);
  return { ...p, activeStages: activeStages(p as unknown as ProjectDoc), ...extra(p) };
}

export async function createProject(ctx: Ctx, input: z.input<typeof projectUpdateSchema> & ProjectInput) {
  const org = await getOrgOrThrow(ctx.orgId);
  const team = await resolveTeam(ctx, input.team);
  // The creator joins the team in their own slot so they keep seeing the project.
  const slot = TEAM_SLOTS.find((s) => s === ctx.roleKey);
  if (slot && !team[slot]) team[slot] = ctx.userOid;
  if (input.leadId) {
    const lead = await Lead.findOne({ _id: input.leadId, orgId: ctx.orgOid }).lean();
    if (!lead) throw notFound('Lead');
    if (lead.projectId) throw conflict(`Lead ${lead.code} is already converted`);
  }
  const defs = structuredClone(org.workflow.stages);
  const init = await initialiseProjectStages(ctx.orgOid, defs);
  const project = await Project.create({
    orgId: ctx.orgOid,
    code: await nextCode(ctx.orgOid, 'project'),
    status: 'active',
    customer: { ...input.customer, email: input.customer.email ?? '' },
    customerType: input.customerType ?? 'residential',
    connectionType: input.connectionType ?? 'on_grid',
    systemSizeKw: input.systemSizeKw,
    contractValue: roundMoney(Number(input.contractValue ?? 0)),
    expectedSubsidy: input.expectedSubsidy,
    team,
    leadId: input.leadId ? oid(input.leadId) : null,
    workflowVersion: org.workflow.version,
    stageDefinitions: defs,
    stages: init.stages,
    currentPhase: init.currentPhase,
    progress: init.progress,
    boq: [],
    subsidy: { status: 'not_applied', amount: input.expectedSubsidy },
    loan: { status: 'not_required' },
    netMetering: { status: 'not_started' },
    targetCompletionDate: input.targetCompletionDate ?? null,
    notes: input.notes,
    createdBy: ctx.userOid,
  });
  if (input.leadId) await Lead.updateOne({ _id: input.leadId, orgId: ctx.orgOid }, { $set: { projectId: project._id } });
  await audit(ctx, { action: 'create', entity: 'project', entityId: project._id, projectId: project._id, summary: `Created project ${project.code} for ${project.customer.name}` });
  await notifyStageOwners(project.toObject(), init.unlocked, ctx.userId);
  return getProjectDetail(ctx, String(project._id));
}

export async function updateProject(ctx: Ctx, id: string, input: z.infer<typeof projectUpdateSchema>) {
  const before = await findVisibleProject(ctx, id);
  const $set: Record<string, unknown> = {};
  if (input.customer) for (const [k, v] of Object.entries(input.customer)) if (v !== undefined) $set[`customer.${k}`] = v;
  for (const k of ['customerType', 'connectionType', 'systemSizeKw', 'expectedSubsidy', 'targetCompletionDate', 'notes'] as const) {
    if (input[k] !== undefined) $set[k] = input[k];
  }
  if (input.contractValue !== undefined) $set.contractValue = roundMoney(input.contractValue);
  if (input.team) {
    if (!can(ctx, 'projects:assign')) throw forbidden('Changing the project team requires the projects:assign permission');
    for (const [slot, v] of Object.entries(await resolveTeam(ctx, input.team))) $set[`team.${slot}`] = v;
  }
  if (input.status && input.status !== before.status) {
    if (input.status === 'completed' && !can(ctx, 'workflow:override')) throw forbidden('Projects are completed by closing the final workflow stage');
    $set.status = input.status;
    if (input.status === 'completed') $set.completedAt = new Date();
    if (before.status === 'completed' && input.status !== 'completed') $set.completedAt = null;
  }
  if (input.leadId !== undefined && !sameId(input.leadId, before.leadId)) {
    if (!(await Lead.exists({ _id: input.leadId, orgId: ctx.orgOid }))) throw notFound('Lead');
    $set.leadId = oid(input.leadId);
  }
  if (Object.keys($set).length) await Project.updateOne({ _id: before._id, orgId: ctx.orgOid }, { $set });
  const flat: Record<string, unknown> = { ...input, customer: input.customer ? { ...before.customer, ...input.customer } : undefined, team: undefined };
  await audit(ctx, { action: 'update', entity: 'project', entityId: before._id, projectId: before._id, summary: `Updated project ${before.code}`, changes: diff(before as any, flat) });
  if (input.team) {
    const fresh = await Project.findById(before._id).lean();
    const newcomers = TEAM_SLOTS.map((s) => fresh?.team?.[s]).filter((u) => u && !Object.values(before.team ?? {}).some((b) => sameId(b, u)));
    await notifyUsers(ctx.orgId, newcomers.map(String), { title: 'Added to a project team', body: `${before.code} · ${before.customer.name}`, link: `/projects/${before._id}` }, ctx.userId);
  }
  return getProjectDetail(ctx, id);
}

export async function deleteProject(ctx: Ctx, id: string) {
  const p = await findVisibleProject(ctx, id);
  await Project.updateOne({ _id: p._id, orgId: ctx.orgOid }, { $set: { deletedAt: new Date() } });
  if (p.leadId) await Lead.updateOne({ _id: p.leadId, orgId: ctx.orgOid }, { $set: { projectId: null } });
  await audit(ctx, { action: 'delete', entity: 'project', entityId: p._id, projectId: p._id, summary: `Deleted project ${p.code}` });
  return { ok: true };
}

export async function setBoq(ctx: Ctx, id: string, input: z.infer<typeof boqSchema>) {
  const p = await findVisibleProject(ctx, id);
  const itemIds = input.items.map((i) => i.itemId).filter(Boolean) as string[];
  if (itemIds.length) {
    const found = await Item.countDocuments({ orgId: ctx.orgOid, _id: { $in: [...new Set(itemIds)] } });
    if (found !== new Set(itemIds).size) throw badRequest('BOQ references unknown inventory items');
  }
  const boq = input.items.map((i) => ({ itemId: i.itemId ? oid(i.itemId) : null, description: i.description, quantity: i.quantity, unit: i.unit ?? 'nos', unitCost: roundMoney(i.unitCost ?? 0) }));
  await Project.updateOne({ _id: p._id, orgId: ctx.orgOid }, { $set: { boq } });
  const total = roundMoney(boq.reduce((s, b) => s + b.quantity * b.unitCost, 0));
  await audit(ctx, { action: 'update', entity: 'project', entityId: p._id, projectId: p._id, summary: `Updated BOQ of ${p.code}: ${boq.length} lines, ${total.toFixed(2)} total` });
  return getProjectDetail(ctx, id);
}

export async function listComments(ctx: Ctx, id: string) {
  const p = await findVisibleProject(ctx, id);
  return ProjectComment.find({ orgId: ctx.orgOid, projectId: p._id }).sort({ createdAt: 1 }).populate('by', USER_REF).lean();
}

export async function addComment(ctx: Ctx, id: string, body: string) {
  const p = await findVisibleProject(ctx, id);
  const c = await ProjectComment.create({ orgId: ctx.orgOid, projectId: p._id, body, by: ctx.userOid });
  await audit(ctx, { action: 'comment', entity: 'project', entityId: p._id, projectId: p._id, summary: `Commented on ${p.code}: ${body.slice(0, 80)}` });
  const recipients = Object.values(p.team ?? {}).filter(Boolean).map(String);
  await notifyUsers(ctx.orgId, recipients, { title: `New comment on ${p.code}`, body: `${ctx.name}: ${body.slice(0, 140)}`, link: `/projects/${p._id}` }, ctx.userId);
  return ProjectComment.findById(c._id).populate('by', USER_REF).lean();
}

export async function projectTimeline(ctx: Ctx, id: string) {
  const p = await findVisibleProject(ctx, id);
  const rows = await AuditLog.find({ orgId: ctx.orgOid, $or: [{ projectId: p._id }, { entity: 'project', entityId: p._id }] })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('userId', USER_REF)
    .lean();
  return rows.map(({ userId, ...r }: any) => ({ ...r, user: userId && userId._id ? userId : null }));
}

export async function projectFinancials(ctx: Ctx, id: string) {
  const p = await findVisibleProject(ctx, id);
  const [received, expenses, material, payments, expenseRows] = await Promise.all([
    receivedByProject(ctx.orgOid, [p._id]),
    expensesByProject(ctx.orgOid, [p._id]),
    materialCostByProject(ctx.orgOid, [p._id]),
    Payment.find({ orgId: ctx.orgOid, projectId: p._id, deletedAt: null }).sort({ receivedAt: -1 }).populate('recordedBy', USER_REF).lean(),
    can(ctx, 'expenses:read') ? Expense.find({ orgId: ctx.orgOid, projectId: p._id }).sort({ incurredAt: -1 }).populate('submittedBy', USER_REF).lean() : Promise.resolve([]),
  ]);
  const r = received.get(String(p._id)) ?? 0;
  const e = expenses.get(String(p._id)) ?? 0;
  const m = material.get(String(p._id)) ?? 0;
  const out: Record<string, unknown> = {
    contractValue: p.contractValue,
    received: r,
    pending: roundMoney(Math.max(0, p.contractValue - r)),
    expenses: e,
    payments,
  };
  out.expenseItems = expenseRows;
  if (can(ctx, 'finance:read')) {
    out.materialCost = m;
    out.profit = roundMoney(r - e - m);
  }
  return out;
}

/** Create or link a `customer` portal user for the project's customer email. */
export async function grantCustomerAccess(ctx: Ctx, id: string) {
  const p = await findVisibleProject(ctx, id);
  const email = p.customer.email?.trim().toLowerCase();
  if (!email) throw badRequest('The project customer has no email address');
  let user = await User.findOne({ email }).lean();
  let inviteUrl: string | null = null;
  if (user) {
    if (!sameId(user.orgId, ctx.orgId) || user.roleKey !== 'customer') throw conflict('This email already belongs to another account');
    if (user.invitePending) inviteUrl = await createInvite(String(user._id));
  } else {
    const created = await User.create({ orgId: ctx.orgOid, name: p.customer.name, email, phone: p.customer.phone, roleKey: 'customer', isActive: true, invitePending: true, invitedBy: ctx.userOid });
    inviteUrl = await createInvite(String(created._id));
    user = created.toObject();
  }
  await Project.updateOne({ _id: p._id, orgId: ctx.orgOid }, { $set: { customerUserId: user._id } });
  await audit(ctx, { action: 'update', entity: 'project', entityId: p._id, projectId: p._id, summary: `Granted customer portal access to ${email} for ${p.code}` });
  if (inviteUrl && !env.isProd) {
    logger.info({ email, inviteUrl }, 'Customer invite link (dev only)');
  }
  const fresh = await User.findById(user._id).lean();
  return { user: fresh, inviteUrl };
}
