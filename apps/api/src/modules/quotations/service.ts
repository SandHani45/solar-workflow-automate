import { computeQuotationTotals, type QuotationInput } from '@solar/shared';
import { can, isOid, oid, type Ctx } from '../../lib/context';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { audit } from '../audit/service';
import { Lead } from '../leads/model';
import { leadScope } from '../leads/service';
import { getOrgOrThrow } from '../org/service';
import { projectScope, visibleProjectIds } from '../projects/access';
import { Project } from '../projects/model';
import { USER_REF } from '../users/model';
import { Quotation, type QuotationDoc } from './model';

type QuotationStatusInput = 'sent' | 'accepted' | 'rejected';

/** Quotations are visible if their project/lead is visible. */
async function quotationScope(ctx: Ctx): Promise<Filter> {
  const base: Filter = { orgId: ctx.orgOid };
  const pIds = await visibleProjectIds(ctx);
  if (!pIds && can(ctx, 'leads:assign')) return base;
  const leadIds = (await Lead.find(leadScope(ctx)).select('_id').lean()).map((l) => l._id);
  const or: Filter[] = [{ leadId: { $in: leadIds }, projectId: null }, { createdBy: ctx.userOid }];
  or.push(pIds ? { projectId: { $in: pIds } } : { projectId: { $ne: null } });
  return { ...base, $or: or };
}

async function findQuotation(ctx: Ctx, id: string): Promise<QuotationDoc> {
  if (!isOid(id)) throw notFound('Quotation');
  const q = await Quotation.findOne({ ...(await quotationScope(ctx)), _id: id }).lean();
  if (!q) throw notFound('Quotation');
  return q;
}

async function assertTarget(ctx: Ctx, input: Pick<QuotationInput, 'projectId' | 'leadId'>) {
  if (!input.projectId && !input.leadId) throw badRequest('Either projectId or leadId is required');
  if (input.projectId && !(await Project.exists({ ...projectScope(ctx), _id: input.projectId }))) throw notFound('Project');
  if (input.leadId && !(await Lead.exists({ ...leadScope(ctx), _id: input.leadId }))) throw notFound('Lead');
}

export async function listQuotations(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'number', 'grandTotal', 'version']);
  const filter: Filter = await quotationScope(ctx);
  if (isOid(query.projectId)) filter.projectId = oid(query.projectId);
  if (isOid(query.leadId)) filter.leadId = oid(query.leadId);
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (typeof query.kind === 'string' && query.kind) filter.kind = query.kind;
  if (p.q) filter.number = searchRegex(p.q);
  const [rows, total] = await Promise.all([
    Quotation.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('createdBy', USER_REF).populate('projectId', 'code customer.name').populate('leadId', 'code name').lean(),
    Quotation.countDocuments(filter),
  ]);
  return { rows: rows.map(shape), meta: pageMeta(p.page, p.limit, total) };
}

function shape(q: any) {
  const project = q.projectId && q.projectId._id ? q.projectId : null;
  const lead = q.leadId && q.leadId._id ? q.leadId : null;
  return {
    ...q,
    projectId: project ? project._id : q.projectId,
    leadId: lead ? lead._id : q.leadId,
    project: project ? { id: project._id, code: project.code, customerName: project.customer?.name } : null,
    lead: lead ? { id: lead._id, code: lead.code, name: lead.name } : null,
  };
}

export async function getQuotation(ctx: Ctx, id: string) {
  await findQuotation(ctx, id);
  const q = await Quotation.findById(id).populate('createdBy', USER_REF).populate('decidedBy', USER_REF).lean();
  const org = await getOrgOrThrow(ctx.orgId);
  const [project, lead] = await Promise.all([
    q!.projectId ? Project.findById(q!.projectId).select('code customer systemSizeKw').lean() : null,
    q!.leadId ? Lead.findById(q!.leadId).select('code name phone email address').lean() : null,
  ]);
  const customer = project?.customer ?? (lead ? { name: lead.name, phone: lead.phone, email: lead.email, address: lead.address } : null);
  return {
    ...q,
    project: project ? { id: project._id, code: project.code } : null,
    lead: lead ? { id: lead._id, code: lead.code } : null,
    customer,
    org: {
      name: org.name,
      address: org.settings?.address,
      phone: org.settings?.phone,
      email: org.settings?.email,
      gstin: org.settings?.gstin,
      logoUrl: org.settings?.logoUrl,
    },
  };
}

export async function createQuotation(ctx: Ctx, input: QuotationInput) {
  await assertTarget(ctx, input);
  const totals = computeQuotationTotals(input.lines, input.discount);
  const scopeKey = input.projectId ? { projectId: oid(input.projectId) } : { leadId: oid(input.leadId!), projectId: null };
  const last = await Quotation.findOne({ orgId: ctx.orgOid, ...scopeKey }).sort({ version: -1 }).select('version').lean();
  const q = await Quotation.create({
    ...input,
    orgId: ctx.orgOid,
    projectId: input.projectId ? oid(input.projectId) : null,
    leadId: input.leadId ? oid(input.leadId) : null,
    number: await nextCode(ctx.orgOid, 'quotation'),
    version: (last?.version ?? 0) + 1,
    status: 'draft',
    ...totals,
    createdBy: ctx.userOid,
  });
  await audit(ctx, { action: 'create', entity: 'quotation', entityId: q._id, projectId: q.projectId, summary: `Created quotation ${q.number} v${q.version} (${totals.grandTotal.toFixed(2)})` });
  return getQuotation(ctx, String(q._id));
}

export async function updateQuotation(ctx: Ctx, id: string, input: Partial<QuotationInput>) {
  const q = await findQuotation(ctx, id);
  if (q.status !== 'draft') throw conflict('Only draft quotations can be edited');
  if (input.projectId || input.leadId) await assertTarget(ctx, { projectId: input.projectId ?? (q.projectId ? String(q.projectId) : undefined), leadId: input.leadId ?? (q.leadId ? String(q.leadId) : undefined) });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) patch[k] = v;
  const lines = input.lines ?? q.lines.map((l) => ({ ...l, itemId: l.itemId ? String(l.itemId) : undefined }));
  Object.assign(patch, computeQuotationTotals(lines, input.discount ?? q.discount));
  await Quotation.updateOne({ _id: q._id, orgId: ctx.orgOid }, { $set: patch });
  await audit(ctx, { action: 'update', entity: 'quotation', entityId: q._id, projectId: q.projectId, summary: `Updated quotation ${q.number}` });
  return getQuotation(ctx, id);
}

export async function setQuotationStatus(ctx: Ctx, id: string, status: QuotationStatusInput) {
  const q = await findQuotation(ctx, id);
  const allowed: Record<string, string[]> = { draft: ['sent', 'accepted', 'rejected'], sent: ['accepted', 'rejected'], accepted: [], rejected: [], superseded: [] };
  if (!allowed[q.status]?.includes(status)) throw conflict(`Cannot change a ${q.status} quotation to ${status}`);
  if (status === 'accepted' && !can(ctx, 'quotations:approve')) throw forbidden('Accepting a quotation requires the quotations:approve permission');
  const now = new Date();
  const scopeKey = q.projectId ? { projectId: q.projectId } : { leadId: q.leadId, projectId: null };

  const set: Record<string, unknown> = { status };
  if (status === 'sent') set.sentAt = now;
  else {
    set.decidedAt = now;
    set.decidedBy = ctx.userOid;
    if (!q.sentAt) set.sentAt = now;
  }
  if (status === 'sent' || (status === 'accepted' && q.status === 'draft')) {
    await Quotation.updateMany({ orgId: ctx.orgOid, ...scopeKey, _id: { $ne: q._id }, status: 'sent' }, { $set: { status: 'superseded' } });
  }
  await Quotation.updateOne({ _id: q._id, orgId: ctx.orgOid }, { $set: set });

  if (status === 'accepted' && q.kind === 'final' && q.projectId) {
    await Project.updateOne({ _id: q.projectId, orgId: ctx.orgOid }, { $set: { contractValue: q.grandTotal, systemSizeKw: q.systemSizeKw } });
  }
  if (status === 'sent' && q.leadId) {
    await Lead.updateOne({ _id: q.leadId, orgId: ctx.orgOid, status: { $in: ['new', 'contacted', 'survey_scheduled'] } }, { $set: { status: 'quotation_sent' } });
  }
  await audit(ctx, {
    action: `quotation.${status}`,
    entity: 'quotation',
    entityId: q._id,
    projectId: q.projectId,
    summary: `Quotation ${q.number} ${status}${status === 'accepted' && q.kind === 'final' && q.projectId ? ` — contract value set to ${q.grandTotal.toFixed(2)}` : ''}`,
    changes: { status: { from: q.status, to: status } },
  });
  return getQuotation(ctx, id);
}
