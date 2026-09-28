import { roundMoney } from '@solar/shared';
import type { Ctx } from '../../lib/context';
import { toCsv, type CsvColumn } from '../../lib/csv';
import { notFound } from '../../lib/errors';
import { audit } from '../audit/service';
import { Expense } from '../expenses/model';
import { receivedByProject, rangeFilter, type DateRange } from '../finance/calc';
import { computeReserved, withStock } from '../inventory/service';
import { Item } from '../inventory/model';
import { Lead } from '../leads/model';
import { Payment } from '../payments/model';
import { Project } from '../projects/model';
import { Ticket } from '../tickets/model';

export const REPORT_KINDS = ['projects', 'leads', 'payments', 'expenses', 'inventory', 'tickets'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

const MAX_ROWS = 50_000;
const d = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : '');
const ref = (u: any) => (u && typeof u === 'object' && 'name' in u ? u.name : '');

async function projectsCsv(ctx: Ctx, range: DateRange) {
  const rows = await Project.find({ orgId: ctx.orgOid, deletedAt: null, ...rangeFilter('createdAt', range) })
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .populate('team.sales team.manager team.engineer', 'name')
    .lean();
  const received = await receivedByProject(ctx.orgOid, rows.map((r) => r._id));
  const cols: CsvColumn<any>[] = [
    { header: 'Code', value: (r) => r.code },
    { header: 'Customer', value: (r) => r.customer?.name },
    { header: 'Phone', value: (r) => r.customer?.phone },
    { header: 'City', value: (r) => r.customer?.address?.city },
    { header: 'Customer type', value: (r) => r.customerType },
    { header: 'System kW', value: (r) => r.systemSizeKw },
    { header: 'Contract value', value: (r) => r.contractValue },
    { header: 'Received', value: (r) => received.get(String(r._id)) ?? 0 },
    { header: 'Pending', value: (r) => roundMoney(Math.max(0, r.contractValue - (received.get(String(r._id)) ?? 0))) },
    { header: 'Status', value: (r) => r.status },
    { header: 'Phase', value: (r) => r.currentPhase },
    { header: 'Progress %', value: (r) => r.progress },
    { header: 'Sales', value: (r) => ref(r.team?.sales) },
    { header: 'Manager', value: (r) => ref(r.team?.manager) },
    { header: 'Engineer', value: (r) => ref(r.team?.engineer) },
    { header: 'Subsidy', value: (r) => r.subsidy?.status },
    { header: 'Net metering', value: (r) => r.netMetering?.status },
    { header: 'Installation date', value: (r) => d(r.installationDate) },
    { header: 'Created', value: (r) => d(r.createdAt) },
    { header: 'Completed', value: (r) => d(r.completedAt) },
  ];
  return toCsv(rows, cols);
}

async function leadsCsv(ctx: Ctx, range: DateRange) {
  const rows = await Lead.find({ orgId: ctx.orgOid, ...rangeFilter('createdAt', range) }).sort({ createdAt: -1 }).limit(MAX_ROWS).populate('assignedTo', 'name').lean();
  return toCsv<any>(rows, [
    { header: 'Code', value: (r) => r.code },
    { header: 'Name', value: (r) => r.name },
    { header: 'Phone', value: (r) => r.phone },
    { header: 'Email', value: (r) => r.email },
    { header: 'City', value: (r) => r.address?.city },
    { header: 'Type', value: (r) => r.customerType },
    { header: 'Source', value: (r) => r.source },
    { header: 'Status', value: (r) => r.status },
    { header: 'Monthly bill', value: (r) => r.monthlyBill },
    { header: 'Required kW', value: (r) => r.requiredKw },
    { header: 'Assigned to', value: (r) => ref(r.assignedTo) },
    { header: 'Follow-up', value: (r) => d(r.followUpAt) },
    { header: 'Lost reason', value: (r) => r.lostReason },
    { header: 'Created', value: (r) => d(r.createdAt) },
  ]);
}

async function paymentsCsv(ctx: Ctx, range: DateRange) {
  const rows = await Payment.find({ orgId: ctx.orgOid, deletedAt: null, ...rangeFilter('receivedAt', range) })
    .sort({ receivedAt: -1 })
    .limit(MAX_ROWS)
    .populate('projectId', 'code customer.name')
    .populate('recordedBy', 'name')
    .lean();
  return toCsv<any>(rows, [
    { header: 'Receipt', value: (r) => r.receiptNo },
    { header: 'Date', value: (r) => d(r.receivedAt) },
    { header: 'Project', value: (r) => r.projectId?.code },
    { header: 'Customer', value: (r) => r.projectId?.customer?.name },
    { header: 'Amount', value: (r) => (r.type === 'refund' ? -r.amount : r.amount) },
    { header: 'Mode', value: (r) => r.mode },
    { header: 'Type', value: (r) => r.type },
    { header: 'Reference', value: (r) => r.reference },
    { header: 'Recorded by', value: (r) => ref(r.recordedBy) },
    { header: 'Note', value: (r) => r.note },
  ]);
}

async function expensesCsv(ctx: Ctx, range: DateRange) {
  const rows = await Expense.find({ orgId: ctx.orgOid, ...rangeFilter('incurredAt', range) })
    .sort({ incurredAt: -1 })
    .limit(MAX_ROWS)
    .populate('projectId', 'code')
    .populate('submittedBy decidedBy', 'name')
    .lean();
  return toCsv<any>(rows, [
    { header: 'Date', value: (r) => d(r.incurredAt) },
    { header: 'Project', value: (r) => r.projectId?.code ?? '' },
    { header: 'Category', value: (r) => r.category },
    { header: 'Description', value: (r) => r.description },
    { header: 'Vendor', value: (r) => r.vendor },
    { header: 'Amount', value: (r) => r.amount },
    { header: 'Paid by', value: (r) => r.paidBy },
    { header: 'Status', value: (r) => r.status },
    { header: 'Submitted by', value: (r) => ref(r.submittedBy) },
    { header: 'Decided by', value: (r) => ref(r.decidedBy) },
  ]);
}

async function inventoryCsv(ctx: Ctx) {
  const [items, reserved] = await Promise.all([Item.find({ orgId: ctx.orgOid, isArchived: false }).sort({ category: 1, name: 1 }).lean(), computeReserved(ctx.orgOid)]);
  return toCsv<any>(
    items.map((i) => withStock(i, reserved)),
    [
      { header: 'SKU', value: (r) => r.sku },
      { header: 'Name', value: (r) => r.name },
      { header: 'Category', value: (r) => r.category },
      { header: 'Brand', value: (r) => r.brand },
      { header: 'Unit', value: (r) => r.unit },
      { header: 'Quantity', value: (r) => r.quantity },
      { header: 'Reserved', value: (r) => r.reserved },
      { header: 'Available', value: (r) => r.available },
      { header: 'Reorder level', value: (r) => r.reorderLevel },
      { header: 'Cost price', value: (r) => r.costPrice },
      { header: 'Stock value', value: (r) => r.stockValue },
      { header: 'Sell price', value: (r) => r.sellPrice },
    ],
  );
}

async function ticketsCsv(ctx: Ctx, range: DateRange) {
  const rows = await Ticket.find({ orgId: ctx.orgOid, ...rangeFilter('createdAt', range) })
    .select('-comments')
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .populate('projectId', 'code customer.name')
    .populate('assignee raisedBy', 'name')
    .lean();
  const now = Date.now();
  return toCsv<any>(rows, [
    { header: 'Code', value: (r) => r.code },
    { header: 'Project', value: (r) => r.projectId?.code },
    { header: 'Customer', value: (r) => r.projectId?.customer?.name },
    { header: 'Subject', value: (r) => r.subject },
    { header: 'Category', value: (r) => r.category },
    { header: 'Priority', value: (r) => r.priority },
    { header: 'Status', value: (r) => r.status },
    { header: 'Assignee', value: (r) => ref(r.assignee) },
    { header: 'Raised by', value: (r) => ref(r.raisedBy) },
    { header: 'Created', value: (r) => d(r.createdAt) },
    { header: 'Due', value: (r) => r.dueAt?.toISOString() },
    { header: 'Overdue', value: (r) => (!['resolved', 'closed'].includes(r.status) && r.dueAt.getTime() < now ? 'yes' : 'no') },
    { header: 'Resolved', value: (r) => d(r.resolvedAt) },
  ]);
}

export async function buildReport(ctx: Ctx, kind: string, range: DateRange): Promise<string> {
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) throw notFound(`Report "${kind}"`);
  const csv =
    kind === 'projects'
      ? await projectsCsv(ctx, range)
      : kind === 'leads'
        ? await leadsCsv(ctx, range)
        : kind === 'payments'
          ? await paymentsCsv(ctx, range)
          : kind === 'expenses'
            ? await expensesCsv(ctx, range)
            : kind === 'inventory'
              ? await inventoryCsv(ctx)
              : await ticketsCsv(ctx, range);
  await audit(ctx, { action: 'export', entity: 'report', summary: `Exported ${kind} report` });
  return csv;
}
