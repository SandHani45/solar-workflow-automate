import { PAYMENT_MODES, computeProfit, roundMoney, splitProfit, type ExpenseCategory, type PaymentMode } from '@solar/shared';
import { can, hasFeature, type Ctx } from '../../lib/context';
import { BUSINESS_TZ, lastMonthKeys, monthStart } from '../../lib/time';
import { Advance } from '../advances/model';
import { Expense } from '../expenses/model';
import { stockValue } from '../inventory/service';
import { getOrgOrThrow } from '../org/service';
import { Payment } from '../payments/model';
import { Project } from '../projects/model';
import { expensesByProject, lastPaymentByProject, materialCostByProject, rangeFilter, receivedByProject, signedPaymentAmount, sumMap, type DateRange } from './calc';

/**
 * Finance dashboard (GET /finance/dashboard).
 *
 * `from`/`to` bound the money *flows* (received, expenses, material cost, profit, by-mode,
 * by-category, partner split). Balances (contract value, pending, pendingCustomers,
 * advances outstanding, stock value, per-project profit) are always all-time, because a
 * receivable does not stop being owed outside the window.
 */
export async function financeDashboard(ctx: Ctx, range: DateRange) {
  const orgId = ctx.orgOid;
  const org = await getOrgOrThrow(ctx.orgId);
  const projects = await Project.find({ orgId, deletedAt: null, status: { $ne: 'cancelled' } })
    .select('code customer contractValue status createdAt')
    .sort({ createdAt: -1 })
    .lean();
  const projectIds = projects.map((p) => p._id);

  const [receivedAll, expensesAllByProject, materialAllByProject, lastPay, receivedInRange, materialInRange] = await Promise.all([
    receivedByProject(orgId, projectIds),
    expensesByProject(orgId, projectIds),
    materialCostByProject(orgId, projectIds),
    lastPaymentByProject(orgId),
    receivedByProject(orgId, null, range),
    materialCostByProject(orgId, null, range),
  ]);

  const paymentMatch = { orgId, deletedAt: null, ...rangeFilter('receivedAt', range) };
  const expenseMatch = { orgId, status: 'approved', ...rangeFilter('incurredAt', range) };

  const [byMode, byCategory, expenseTotalRows, advances, stock, monthlyPay, monthlyExp] = await Promise.all([
    Payment.aggregate<{ _id: PaymentMode; amount: number }>([{ $match: paymentMatch }, { $group: { _id: '$mode', amount: { $sum: signedPaymentAmount } } }]),
    Expense.aggregate<{ _id: ExpenseCategory; amount: number }>([{ $match: expenseMatch }, { $group: { _id: '$category', amount: { $sum: '$amount' } } }]),
    // Company-level total includes expenses not tied to a project (office, salary, …).
    Expense.aggregate<{ total: number }>([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Advance.find({ orgId, status: 'outstanding' }).lean(),
    stockValue(orgId),
    Payment.aggregate<{ _id: string; amount: number }>([
      { $match: { orgId, deletedAt: null, receivedAt: { $gte: monthStart(new Date(), 11) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$receivedAt', timezone: BUSINESS_TZ } }, amount: { $sum: signedPaymentAmount } } },
    ]),
    Expense.aggregate<{ _id: string; amount: number }>([
      { $match: { orgId, status: 'approved', incurredAt: { $gte: monthStart(new Date(), 11) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$incurredAt', timezone: BUSINESS_TZ } }, amount: { $sum: '$amount' } } },
    ]),
  ]);

  const received = sumMap(receivedInRange);
  const expenses = roundMoney(expenseTotalRows[0]?.total ?? 0);
  const materialCost = sumMap(materialInRange);
  const profit = computeProfit({ received, expenses, materialCost });
  const contractValue = roundMoney(projects.reduce((s, p) => s + (p.contractValue ?? 0), 0));

  const pendingCustomers = projects
    .map((p) => {
      const r = receivedAll.get(String(p._id)) ?? 0;
      return {
        projectId: String(p._id),
        code: p.code,
        customerName: p.customer?.name,
        phone: p.customer?.phone,
        contractValue: p.contractValue,
        received: r,
        pending: roundMoney(Math.max(0, (p.contractValue ?? 0) - r)),
        lastPaymentAt: lastPay.get(String(p._id)),
      };
    })
    .filter((r) => r.pending > 0)
    .sort((a, b) => b.pending - a.pending);
  const pending = roundMoney(pendingCustomers.reduce((s, r) => s + r.pending, 0));

  const advGroups = new Map<string, { personName: string; kind: string; outstanding: number }>();
  for (const a of advances) {
    const k = `${a.kind}:${a.personName.trim().toLowerCase()}`;
    const g = advGroups.get(k) ?? { personName: a.personName, kind: a.kind, outstanding: 0 };
    g.outstanding = roundMoney(g.outstanding + a.amount);
    advGroups.set(k, g);
  }
  const advancesOutstanding = roundMoney(advances.reduce((s, a) => s + a.amount, 0));

  let partnerSplit: ReturnType<typeof splitProfit> = [];
  if (can(ctx, 'finance:partners') && hasFeature(ctx, 'partner_profit_split')) {
    const partnerAdvances: Record<string, number> = {};
    for (const a of advances.filter((x) => x.kind === 'partner')) {
      const partner = org.partners.find((p) => (a.userId && p.userId && String(p.userId) === String(a.userId)) || p.name.trim().toLowerCase() === a.personName.trim().toLowerCase());
      const name = partner?.name ?? a.personName;
      partnerAdvances[name] = roundMoney((partnerAdvances[name] ?? 0) + a.amount);
    }
    partnerSplit = splitProfit(profit, org.partners.map((p) => ({ name: p.name, sharePercent: p.sharePercent, userId: p.userId ? String(p.userId) : undefined })), partnerAdvances);
  }

  const payByMonth = new Map(monthlyPay.map((m) => [m._id, roundMoney(m.amount)]));
  const expByMonth = new Map(monthlyExp.map((m) => [m._id, roundMoney(m.amount)]));

  return {
    totals: { contractValue, received, pending, expenses, materialCost, advancesOutstanding, stockValue: stock, profit },
    receivedByMode: PAYMENT_MODES.map((mode) => ({ mode, amount: roundMoney(byMode.find((b) => b._id === mode)?.amount ?? 0) })).filter((r) => r.amount !== 0),
    expensesByCategory: byCategory.map((c) => ({ category: c._id, amount: roundMoney(c.amount) })).sort((a, b) => b.amount - a.amount),
    pendingCustomers,
    advances: [...advGroups.values()].sort((a, b) => b.outstanding - a.outstanding),
    partnerSplit,
    monthly: lastMonthKeys(12).map((month) => ({ month, received: payByMonth.get(month) ?? 0, expenses: expByMonth.get(month) ?? 0 })),
    projectProfit: projects.map((p) => {
      const id = String(p._id);
      const r = receivedAll.get(id) ?? 0;
      const e = expensesAllByProject.get(id) ?? 0;
      const m = materialAllByProject.get(id) ?? 0;
      return { projectId: id, code: p.code, customerName: p.customer?.name, received: r, expenses: e, materialCost: m, profit: computeProfit({ received: r, expenses: e, materialCost: m }) };
    }),
  };
}
