import { roundMoney, type DispatchStatus, type ItemInput, type StockMovementType } from '@solar/shared';
import { can, isOid, oid, type Ctx } from '../../lib/context';
import { conflict, forbidden, notFound } from '../../lib/errors';
import type { Filter, ObjectId } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { audit, diff } from '../audit/service';
import { Dispatch } from '../dispatches/model';
import { Project } from '../projects/model';
import { Item, StockMovement, type ItemDoc, type MovementDoc } from './model';

/** Dispatch states in which BOQ stock has physically left the warehouse. */
const ISSUED_STATES: DispatchStatus[] = ['in_transit', 'delivered', 'unloaded'];

/**
 * Reserved stock per item: BOQ quantities of active projects whose BOQ was reserved
 * (automation `reserve_boq_stock`) and whose material has not been dispatched yet.
 */
export async function computeReserved(orgId: ObjectId): Promise<Map<string, number>> {
  const projects = await Project.find({ orgId, status: 'active', deletedAt: null, boqReserved: true }).select('_id boq').lean();
  if (!projects.length) return new Map();
  const issued = new Set(
    (await Dispatch.find({ orgId, projectId: { $in: projects.map((p) => p._id) }, status: { $in: ISSUED_STATES } }).select('projectId').lean()).map((d) =>
      String(d.projectId),
    ),
  );
  const reserved = new Map<string, number>();
  for (const p of projects) {
    if (issued.has(String(p._id))) continue;
    for (const line of p.boq ?? []) {
      if (!line.itemId || !(line.quantity > 0)) continue;
      reserved.set(String(line.itemId), (reserved.get(String(line.itemId)) ?? 0) + line.quantity);
    }
  }
  return reserved;
}

export function withStock(item: ItemDoc, reserved: Map<string, number>) {
  const r = reserved.get(String(item._id)) ?? 0;
  const available = Math.max(0, item.quantity - r);
  return {
    ...item,
    reserved: r,
    available,
    stockValue: roundMoney(item.quantity * item.costPrice),
    lowStock: available <= item.reorderLevel,
  };
}

export async function listItems(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['name', 'sku', 'category', 'quantity', 'createdAt', 'costPrice'], 'name');
  const filter: Filter = { orgId: ctx.orgOid };
  if (query.includeArchived !== 'true') filter.isArchived = false;
  if (typeof query.category === 'string' && query.category) filter.category = query.category;
  if (p.q) {
    const rx = searchRegex(p.q);
    filter.$or = [{ name: rx }, { sku: rx }, { brand: rx }];
  }
  const [items, reserved] = await Promise.all([Item.find(filter).sort(p.sort).lean(), computeReserved(ctx.orgOid)]);
  let rows = items.map((i) => withStock(i, reserved));
  if (query.lowStock === 'true') rows = rows.filter((r) => r.lowStock);
  return { rows: rows.slice(p.skip, p.skip + p.limit), meta: pageMeta(p.page, p.limit, rows.length) };
}

export async function getItem(ctx: Ctx, id: string) {
  if (!isOid(id)) throw notFound('Item');
  const item = await Item.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!item) throw notFound('Item');
  return item;
}

export async function createItem(ctx: Ctx, input: ItemInput) {
  if (await Item.exists({ orgId: ctx.orgOid, sku: input.sku })) throw conflict(`SKU "${input.sku}" already exists`);
  const item = await Item.create({ ...input, orgId: ctx.orgOid, quantity: 0 });
  await audit(ctx, { action: 'create', entity: 'item', entityId: item._id, summary: `Added item ${item.sku} · ${item.name}` });
  return withStock(item.toObject(), new Map());
}

export async function updateItem(ctx: Ctx, id: string, input: Partial<ItemInput>) {
  const before = await getItem(ctx, id);
  if (input.sku && input.sku !== before.sku && (await Item.exists({ orgId: ctx.orgOid, sku: input.sku }))) throw conflict(`SKU "${input.sku}" already exists`);
  const updated = await Item.findOneAndUpdate({ _id: before._id, orgId: ctx.orgOid }, { $set: input }, { returnDocument: 'after', runValidators: true }).lean();
  await audit(ctx, { action: 'update', entity: 'item', entityId: before._id, summary: `Updated item ${before.sku}`, changes: diff(before, input) });
  return withStock(updated!, await computeReserved(ctx.orgOid));
}

export async function archiveItem(ctx: Ctx, id: string) {
  const before = await getItem(ctx, id);
  await Item.updateOne({ _id: before._id, orgId: ctx.orgOid }, { $set: { isArchived: true } });
  await audit(ctx, { action: 'delete', entity: 'item', entityId: before._id, summary: `Archived item ${before.sku}` });
  return { ok: true };
}

export interface MovementInput {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  projectId?: string;
  reference?: string;
  note?: string;
  /** For `adjust`: write-off (decrease, default) or found stock (increase). */
  direction?: 'increase' | 'decrease';
  dispatchId?: ObjectId;
}

export function assertMovementPermission(ctx: Ctx, type: StockMovementType) {
  const perm = type === 'in' || type === 'return' ? 'inventory:write' : 'inventory:adjust';
  if (!can(ctx, perm)) throw forbidden(`Missing permission: ${perm}`);
}

/**
 * Apply one stock movement atomically.
 * - `in`: increases quantity and updates weighted-average cost.
 * - `out`: decreases quantity at current cost; cannot go negative (409).
 * - `return`: increases quantity (at the given/current cost, average unchanged).
 * - `adjust`: decrease (write-off, default) or increase; cannot go negative.
 */
export async function applyMovement(ctx: Ctx, input: MovementInput, opts: { audit?: boolean } = {}): Promise<MovementDoc> {
  const item = await getItem(ctx, input.itemId);
  if (input.projectId && !(await Project.exists({ _id: input.projectId, orgId: ctx.orgOid, deletedAt: null }))) throw notFound('Project');
  const qty = input.quantity;
  let after: ItemDoc | null;
  let unitCost = item.costPrice;
  let signedQty = qty;

  if (input.type === 'in') {
    unitCost = roundMoney(input.unitCost ?? item.costPrice);
    const res = await Item.collection.findOneAndUpdate(
      { _id: item._id, orgId: ctx.orgOid },
      [
        {
          $set: {
            costPrice: {
              $round: [
                {
                  $cond: [
                    { $gt: [{ $add: ['$quantity', qty] }, 0] },
                    { $divide: [{ $add: [{ $multiply: [{ $max: ['$quantity', 0] }, '$costPrice'] }, qty * unitCost] }, { $add: [{ $max: ['$quantity', 0] }, qty] }] },
                    unitCost,
                  ],
                },
                2,
              ],
            },
            quantity: { $add: ['$quantity', qty] },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after' },
    );
    after = res as unknown as ItemDoc | null;
  } else if (input.type === 'out' || (input.type === 'adjust' && input.direction !== 'increase')) {
    after = await Item.findOneAndUpdate({ _id: item._id, orgId: ctx.orgOid, quantity: { $gte: qty } }, { $inc: { quantity: -qty } }, { returnDocument: 'after' }).lean();
    if (!after) throw conflict(`Insufficient stock for ${item.name}: ${item.quantity} ${item.unit} available, ${qty} requested`, { itemId: String(item._id), available: item.quantity, requested: qty });
    if (input.type === 'adjust') signedQty = -qty;
  } else {
    // return, or adjust increase
    if (input.type === 'return' && input.unitCost !== undefined) unitCost = roundMoney(input.unitCost);
    after = await Item.findOneAndUpdate({ _id: item._id, orgId: ctx.orgOid }, { $inc: { quantity: qty } }, { returnDocument: 'after' }).lean();
  }
  if (!after) throw notFound('Item');

  const movement = await StockMovement.create({
    orgId: ctx.orgOid,
    itemId: item._id,
    type: input.type,
    quantity: signedQty,
    unitCost,
    projectId: input.projectId ? oid(input.projectId) : null,
    dispatchId: input.dispatchId ?? null,
    reference: input.reference,
    note: input.note,
    balanceAfter: after.quantity,
    by: ctx.userOid,
  });
  if (opts.audit !== false) {
    await audit(ctx, {
      action: `stock.${input.type}`,
      entity: 'item',
      entityId: item._id,
      projectId: input.projectId ?? null,
      summary: `Stock ${input.type}${input.type === 'adjust' ? ` (${input.direction ?? 'decrease'})` : ''}: ${qty} ${item.unit} of ${item.name} (balance ${after.quantity})`,
    });
  }
  return movement.toObject();
}

export async function listMovements(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt']);
  const filter: Filter = { orgId: ctx.orgOid };
  if (isOid(query.itemId)) filter.itemId = oid(query.itemId);
  if (isOid(query.projectId)) filter.projectId = oid(query.projectId);
  if (typeof query.type === 'string' && query.type) filter.type = query.type;
  const [rows, total] = await Promise.all([
    StockMovement.find(filter)
      .sort(p.sort)
      .skip(p.skip)
      .limit(p.limit)
      .populate('itemId', 'sku name unit category')
      .populate('projectId', 'code customer.name')
      .populate('by', 'name email roleKey')
      .lean(),
    StockMovement.countDocuments(filter),
  ]);
  // Expose populated refs as `item`, `project`, `by` while keeping the raw ids.
  const data = rows.map((m: any) => ({
    ...m,
    itemId: m.itemId?._id ?? m.itemId,
    item: m.itemId && m.itemId._id ? m.itemId : null,
    projectId: m.projectId?._id ?? m.projectId ?? null,
    project: m.projectId && m.projectId._id ? { id: m.projectId._id, code: m.projectId.code, customerName: m.projectId.customer?.name } : null,
  }));
  return { rows: data, meta: pageMeta(p.page, p.limit, total) };
}

export async function inventorySummary(ctx: Ctx) {
  const [items, reserved] = await Promise.all([Item.find({ orgId: ctx.orgOid, isArchived: false }).lean(), computeReserved(ctx.orgOid)]);
  const rows = items.map((i) => withStock(i, reserved));
  const byCat = new Map<string, { category: string; value: number; quantity: number }>();
  for (const r of rows) {
    const c = byCat.get(r.category) ?? { category: r.category, value: 0, quantity: 0 };
    c.value = roundMoney(c.value + r.stockValue);
    c.quantity += r.quantity;
    byCat.set(r.category, c);
  }
  return {
    totalItems: rows.length,
    totalValue: roundMoney(rows.reduce((s, r) => s + r.stockValue, 0)),
    lowStock: rows.filter((r) => r.lowStock),
    byCategory: [...byCat.values()].sort((a, b) => b.value - a.value),
  };
}

export async function stockValue(orgId: ObjectId): Promise<number> {
  const rows: { total: number }[] = await Item.aggregate([
    { $match: { orgId, isArchived: false } },
    { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$costPrice'] } } } },
  ]);
  return roundMoney(rows[0]?.total ?? 0);
}

export async function lowStockCount(orgId: ObjectId): Promise<number> {
  const [items, reserved] = await Promise.all([Item.find({ orgId, isArchived: false }).lean(), computeReserved(orgId)]);
  return items.filter((i) => withStock(i, reserved).lowStock).length;
}
