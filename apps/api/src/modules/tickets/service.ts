import { TICKET_SLA_HOURS, type TicketInput, type TicketPriority, type TicketStatus } from '@solar/shared';
import type { z } from 'zod';
import type { ticketUpdateSchema } from '@solar/shared';
import { can, isOid, oid, sameId, type Ctx } from '../../lib/context';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { audit, diff } from '../audit/service';
import { notifyUsers, userIdsWithPermission } from '../notifications/service';
import { findVisibleProject, visibleProjectIds } from '../projects/access';
import { User, USER_REF } from '../users/model';
import { Ticket, type TicketDoc } from './model';

const CLOSED: TicketStatus[] = ['resolved', 'closed'];
const HOUR = 3_600_000;

export const isCustomer = (ctx: Ctx) => ctx.roleKey === 'customer';

/**
 * Customers see tickets on their own projects. Staff without `tickets:assign` see tickets
 * assigned to them or unassigned (on projects they can see). Assigners see everything.
 */
export async function ticketScope(ctx: Ctx): Promise<Filter> {
  const base: Filter = { orgId: ctx.orgOid };
  if (isCustomer(ctx)) {
    const ids = (await visibleProjectIds(ctx)) ?? [];
    return { ...base, $or: [{ projectId: { $in: ids } }, { raisedBy: ctx.userOid }] };
  }
  if (can(ctx, 'tickets:assign')) return base;
  const ids = await visibleProjectIds(ctx);
  const mine: Filter[] = [{ assignee: ctx.userOid }, { raisedBy: ctx.userOid }, ids ? { assignee: null, projectId: { $in: ids } } : { assignee: null }];
  return { ...base, $or: mine };
}

const dueFrom = (from: Date, priority: TicketPriority) => new Date(from.getTime() + TICKET_SLA_HOURS[priority] * HOUR);

function shape(t: any) {
  const p = t.projectId && t.projectId._id ? t.projectId : null;
  const overdue = !CLOSED.includes(t.status) && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();
  const { comments, ...rest } = t;
  return {
    ...rest,
    projectId: p ? p._id : t.projectId,
    project: p ? { code: p.code, customerName: p.customer?.name } : null,
    overdue,
    ...(comments !== undefined ? { comments } : {}),
  };
}

const populate = (q: any) =>
  q.populate('projectId', 'code customer.name').populate('assignee', USER_REF).populate('raisedBy', USER_REF).populate('comments.by', USER_REF);

async function findTicket(ctx: Ctx, id: string): Promise<TicketDoc> {
  if (!isOid(id)) throw notFound('Ticket');
  const t = await Ticket.findOne({ ...(await ticketScope(ctx)), _id: id }).lean();
  if (!t) throw notFound('Ticket');
  return t;
}

export async function listTickets(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'dueAt', 'priority', 'status', 'code']);
  const filter: Filter = await ticketScope(ctx);
  const and: Filter[] = [];
  if (typeof query.status === 'string' && query.status) {
    if (query.status === 'active') filter.status = { $nin: CLOSED };
    else filter.status = { $in: query.status.split(',') };
  }
  if (typeof query.priority === 'string' && query.priority) filter.priority = query.priority;
  if (typeof query.category === 'string' && query.category) filter.category = query.category;
  if (isOid(query.assigneeId)) filter.assignee = oid(query.assigneeId);
  else if (query.assigneeId === 'none') filter.assignee = null;
  if (isOid(query.projectId)) filter.projectId = oid(query.projectId);
  if (query.overdue === 'true') {
    filter.dueAt = { $lt: new Date() };
    filter.status = { $nin: CLOSED };
  }
  if (p.q) and.push({ $or: [{ code: searchRegex(p.q) }, { subject: searchRegex(p.q) }] });
  if (and.length) filter.$and = and;
  const [rows, total] = await Promise.all([populate(Ticket.find(filter).select('-comments').sort(p.sort).skip(p.skip).limit(p.limit)).lean(), Ticket.countDocuments(filter)]);
  return { rows: rows.map(shape), meta: pageMeta(p.page, p.limit, total) };
}

export async function getTicket(ctx: Ctx, id: string) {
  const t = await findTicket(ctx, id);
  return shape(await populate(Ticket.findById(t._id)).lean());
}

export async function createTicket(ctx: Ctx, input: TicketInput) {
  const project = await findVisibleProject(ctx, input.projectId);
  const now = new Date();
  const t = await Ticket.create({
    ...input,
    orgId: ctx.orgOid,
    projectId: project._id,
    code: await nextCode(ctx.orgOid, 'ticket'),
    status: 'open',
    raisedBy: ctx.userOid,
    dueAt: dueFrom(now, input.priority),
    comments: [],
  });
  await audit(ctx, { action: 'create', entity: 'ticket', entityId: t._id, projectId: project._id, summary: `Raised ticket ${t.code} (${t.priority}): ${t.subject}` });
  const assigners = await userIdsWithPermission(ctx.orgOid, 'tickets:assign');
  await notifyUsers(ctx.orgId, assigners, { title: `New ${t.priority} ticket ${t.code}`, body: `${project.code} · ${t.subject}`, link: `/service/tickets/${t._id}` }, ctx.userId);
  return getTicket(ctx, String(t._id));
}

export async function updateTicket(ctx: Ctx, id: string, input: z.infer<typeof ticketUpdateSchema>) {
  const t = await findTicket(ctx, id);
  const set: Record<string, unknown> = {};
  const now = new Date();

  if (isCustomer(ctx)) {
    const touched = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (touched.some((k) => k !== 'status')) throw forbidden('Customers can only close or reopen tickets');
    const ok = (t.status === 'resolved' && input.status === 'closed') || (CLOSED.includes(t.status) && input.status === 'open');
    if (input.status && !ok) throw forbidden('Customers can only close a resolved ticket or reopen it');
  }

  if (input.assigneeId !== undefined && !sameId(input.assigneeId, t.assignee)) {
    if (!can(ctx, 'tickets:assign')) throw forbidden('Assigning tickets requires the tickets:assign permission');
    if (input.assigneeId && !(await User.exists({ _id: input.assigneeId, orgId: ctx.orgOid, isActive: true }))) throw badRequest('Assignee must be an active user in your organisation');
    set.assignee = input.assigneeId ? oid(input.assigneeId) : null;
    if (input.assigneeId && t.status === 'open' && !input.status) set.status = 'assigned';
  }
  if (input.priority && input.priority !== t.priority) {
    set.priority = input.priority;
    set.dueAt = dueFrom(t.createdAt, input.priority);
  }
  if (input.resolution !== undefined) set.resolution = input.resolution;
  if (input.status && input.status !== t.status) {
    set.status = input.status;
    if (input.status === 'resolved') set.resolvedAt = now;
    if (input.status === 'closed') {
      set.closedAt = now;
      if (!t.resolvedAt) set.resolvedAt = now;
    }
    if (!CLOSED.includes(input.status) && CLOSED.includes(t.status)) {
      set.resolvedAt = null;
      set.closedAt = null;
      // Reopened tickets get a fresh SLA window.
      set.dueAt = dueFrom(now, (input.priority ?? t.priority) as TicketPriority);
    }
  }
  if (!Object.keys(set).length) return getTicket(ctx, id);
  await Ticket.updateOne({ _id: t._id, orgId: ctx.orgOid }, { $set: set });
  await audit(ctx, { action: 'update', entity: 'ticket', entityId: t._id, projectId: t.projectId, summary: `Updated ticket ${t.code}${set.status ? ` → ${String(set.status)}` : ''}`, changes: diff(t as any, set) });

  if (set.assignee) await notifyUsers(ctx.orgId, [String(set.assignee)], { title: `Ticket ${t.code} assigned to you`, body: t.subject, link: `/service/tickets/${t._id}` }, ctx.userId);
  if (set.status) {
    const watchers = [t.raisedBy, t.assignee].filter(Boolean).map(String);
    await notifyUsers(ctx.orgId, watchers, { title: `Ticket ${t.code} is ${String(set.status).replace('_', ' ')}`, body: t.subject, link: `/service/tickets/${t._id}` }, ctx.userId);
  }
  return getTicket(ctx, id);
}

export async function addTicketComment(ctx: Ctx, id: string, body: string) {
  const t = await findTicket(ctx, id);
  await Ticket.updateOne({ _id: t._id, orgId: ctx.orgOid }, { $push: { comments: { body, by: ctx.userOid, at: new Date() } } });
  await audit(ctx, { action: 'comment', entity: 'ticket', entityId: t._id, projectId: t.projectId, summary: `Commented on ticket ${t.code}` });
  const watchers = [t.raisedBy, t.assignee].filter(Boolean).map(String);
  await notifyUsers(ctx.orgId, watchers, { title: `New comment on ${t.code}`, body: `${ctx.name}: ${body.slice(0, 140)}`, link: `/service/tickets/${t._id}` }, ctx.userId);
  return getTicket(ctx, id);
}

export async function openTicketCount(ctx: Ctx): Promise<number> {
  return Ticket.countDocuments({ ...(await ticketScope(ctx)), status: { $nin: CLOSED } });
}
