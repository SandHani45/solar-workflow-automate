import type { z } from 'zod';
import type { DispatchStatus, dispatchSchema } from '@solar/shared';
import { isOid, type Ctx } from '../../lib/context';
import { conflict, notFound, badRequest } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { nextCode } from '../../lib/sequence';
import { audit } from '../audit/service';
import { Item, StockMovement } from '../inventory/model';
import { applyMovement } from '../inventory/service';
import { projectIdFilter, scopedProjectFilter } from '../projects/access';
import { Project } from '../projects/model';
import { Dispatch, type DispatchDoc } from './model';

type DispatchInput = z.infer<typeof dispatchSchema>;

/** Allowed transitions. `cancelled` and `unloaded` are terminal. */
const TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  planned: ['packed', 'in_transit', 'delivered', 'unloaded', 'cancelled'],
  packed: ['planned', 'in_transit', 'delivered', 'unloaded', 'cancelled'],
  in_transit: ['delivered', 'unloaded', 'cancelled'],
  delivered: ['unloaded', 'cancelled'],
  unloaded: [],
  cancelled: [],
};
const ISSUING: DispatchStatus[] = ['in_transit', 'delivered', 'unloaded'];

export async function createDispatch(ctx: Ctx, input: DispatchInput): Promise<DispatchDoc> {
  const project = await Project.findOne({ _id: input.projectId, orgId: ctx.orgOid, deletedAt: null }).select('_id code').lean();
  if (!project) throw notFound('Project');
  const ids = input.items.map((i) => String(i.itemId));
  const items = await Item.find({ orgId: ctx.orgOid, _id: { $in: ids } }).lean();
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw badRequest(`Unknown inventory items: ${missing.join(', ')}`);
  const doc = await Dispatch.create({
    orgId: ctx.orgOid,
    code: await nextCode(ctx.orgOid, 'dispatch'),
    projectId: project._id,
    items: input.items.map((i) => {
      const it = byId.get(String(i.itemId))!;
      return { itemId: it._id, name: it.name, sku: it.sku, unit: it.unit, quantity: Number(i.quantity) };
    }),
    scheduledDate: input.scheduledDate,
    vehicleNo: input.vehicleNo,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    notes: input.notes,
    status: 'planned',
    history: [{ status: 'planned', by: ctx.userOid, at: new Date() }],
    createdBy: ctx.userOid,
  });
  await audit(ctx, { action: 'create', entity: 'dispatch', entityId: doc._id, projectId: project._id, summary: `Planned dispatch ${doc.code} for ${project.code}` });
  return doc.toObject();
}

async function populated(filter: Filter) {
  return Dispatch.findOne(filter).populate('projectId', 'code customer').populate('history.by', 'name email roleKey').lean();
}

function shape(d: any) {
  if (!d) return d;
  const p = d.projectId && d.projectId._id ? d.projectId : null;
  return {
    ...d,
    projectId: p ? p._id : d.projectId,
    project: p ? { id: p._id, code: p.code, customerName: p.customer?.name, address: p.customer?.address } : null,
  };
}

export async function listDispatches(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'scheduledDate', 'code']);
  const filter: Filter = { orgId: ctx.orgOid, ...(await scopedProjectFilter(ctx, query.projectId)) };
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (p.q) filter.$or = [{ code: searchRegex(p.q) }, { vehicleNo: searchRegex(p.q) }];
  const [rows, total] = await Promise.all([
    Dispatch.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('projectId', 'code customer').lean(),
    Dispatch.countDocuments(filter),
  ]);
  return { rows: rows.map(shape), meta: pageMeta(p.page, p.limit, total) };
}

export async function getDispatch(ctx: Ctx, id: string) {
  if (!isOid(id)) throw notFound('Dispatch');
  const d = await populated({ _id: id, orgId: ctx.orgOid, ...(await projectIdFilter(ctx)) });
  if (!d) throw notFound('Dispatch');
  return shape(d);
}

/**
 * Move a dispatch through its lifecycle. Entering in_transit/delivered/unloaded issues stock
 * (`out` movements at item cost, once). Cancelling after issue returns the stock.
 */
export async function setDispatchStatus(ctx: Ctx, id: string, status: DispatchStatus, note?: string) {
  if (!isOid(id)) throw notFound('Dispatch');
  const d = await Dispatch.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!d) throw notFound('Dispatch');
  if (d.status === status) return getDispatch(ctx, id);
  if (!TRANSITIONS[d.status].includes(status)) throw conflict(`Cannot move dispatch from ${d.status} to ${status}`);

  if (ISSUING.includes(status) && !d.stockIssuedAt) await issueStock(ctx, d);
  if (status === 'cancelled' && d.stockIssuedAt && !d.stockReturnedAt) await returnStock(ctx, d);

  await Dispatch.updateOne(
    { _id: d._id, orgId: ctx.orgOid },
    { $set: { status }, $push: { history: { status, note, by: ctx.userOid, at: new Date() } } },
  );
  const project = await Project.findById(d.projectId).select('code').lean();
  await audit(ctx, { action: `dispatch.${status}`, entity: 'dispatch', entityId: d._id, projectId: d.projectId, summary: `Dispatch ${d.code} → ${status}${project ? ` (${project.code})` : ''}` });
  return getDispatch(ctx, id);
}

async function issueStock(ctx: Ctx, d: DispatchDoc) {
  // Claim the issue atomically so concurrent calls cannot double-issue.
  const claimed = await Dispatch.findOneAndUpdate({ _id: d._id, orgId: ctx.orgOid, stockIssuedAt: null }, { $set: { stockIssuedAt: new Date() } });
  if (!claimed) return;
  // Pre-check availability so we fail before touching any stock.
  const items = await Item.find({ orgId: ctx.orgOid, _id: { $in: d.items.map((i) => i.itemId) } }).lean();
  const short = d.items.filter((line) => (items.find((i) => String(i._id) === String(line.itemId))?.quantity ?? 0) < line.quantity);
  if (short.length) {
    await Dispatch.updateOne({ _id: d._id }, { $set: { stockIssuedAt: null } });
    throw conflict(`Insufficient stock: ${short.map((s) => s.name).join(', ')}`, { items: short.map((s) => ({ itemId: String(s.itemId), name: s.name, requested: s.quantity })) });
  }
  const done: string[] = [];
  try {
    for (const line of d.items) {
      // Idempotency guard per line (e.g. after a partial failure + retry).
      if (await StockMovement.exists({ orgId: ctx.orgOid, dispatchId: d._id, itemId: line.itemId, type: 'out' })) continue;
      const m = await applyMovement(
        ctx,
        { itemId: String(line.itemId), type: 'out', quantity: line.quantity, projectId: String(d.projectId), dispatchId: d._id, reference: d.code, note: `Dispatch ${d.code}` },
        { audit: false },
      );
      done.push(String(m._id));
    }
  } catch (err) {
    // Roll back movements made by this call.
    for (const mid of done) {
      const m = await StockMovement.findByIdAndDelete(mid).lean();
      if (m) await Item.updateOne({ _id: m.itemId }, { $inc: { quantity: m.quantity } });
    }
    await Dispatch.updateOne({ _id: d._id }, { $set: { stockIssuedAt: null } });
    throw err;
  }
}

async function returnStock(ctx: Ctx, d: DispatchDoc) {
  const claimed = await Dispatch.findOneAndUpdate({ _id: d._id, orgId: ctx.orgOid, stockReturnedAt: null }, { $set: { stockReturnedAt: new Date() } });
  if (!claimed) return;
  const outs = await StockMovement.find({ orgId: ctx.orgOid, dispatchId: d._id, type: 'out' }).lean();
  for (const m of outs) {
    if (await StockMovement.exists({ orgId: ctx.orgOid, dispatchId: d._id, itemId: m.itemId, type: 'return' })) continue;
    await applyMovement(
      ctx,
      { itemId: String(m.itemId), type: 'return', quantity: m.quantity, unitCost: m.unitCost, projectId: String(d.projectId), dispatchId: d._id, reference: d.code, note: `Dispatch ${d.code} cancelled` },
      { audit: false },
    );
  }
}
