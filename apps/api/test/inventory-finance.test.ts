import { beforeAll, describe, expect, it } from 'vitest';
import { StockMovement } from '../src/modules/inventory/model';
import { Project } from '../src/modules/projects/model';
import { createProject, orgWithTeam, type TestOrg } from './helpers';

describe('inventory & dispatch', () => {
  let org: TestOrg;
  let itemId: string;
  let project: any;

  beforeAll(async () => {
    org = await orgWithTeam(['warehouse', 'accounts', 'engineer']);
    const item = await org.owner.post('/api/v1/inventory/items').send({ sku: 'INV-5K', name: 'Inverter 5kW', category: 'inverter', costPrice: 0, reorderLevel: 2 });
    itemId = item.body.data.id;
    project = await createProject(org.owner);
  });

  it('stock in uses weighted-average cost', async () => {
    const wh = org.users.warehouse!.agent;
    await wh.post('/api/v1/inventory/movements').send({ itemId, type: 'in', quantity: 10, unitCost: 100 });
    const m = await wh.post('/api/v1/inventory/movements').send({ itemId, type: 'in', quantity: 10, unitCost: 200 });
    expect(m.status).toBe(201);
    expect(m.body.data.balanceAfter).toBe(20);
    const items = await wh.get('/api/v1/inventory/items');
    expect(items.body.data[0]).toMatchObject({ quantity: 20, costPrice: 150, stockValue: 3000, available: 20, reserved: 0 });
  });

  it('out cannot exceed stock (409) and needs inventory:adjust', async () => {
    const res = await org.users.warehouse!.agent.post('/api/v1/inventory/movements').send({ itemId, type: 'out', quantity: 21 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    const noPerm = await org.users.accounts!.agent.post('/api/v1/inventory/movements').send({ itemId, type: 'out', quantity: 1 });
    expect(noPerm.status).toBe(403);
    const adj = await org.users.warehouse!.agent.post('/api/v1/inventory/movements').send({ itemId, type: 'adjust', quantity: 2, note: 'damaged' });
    expect(adj.status).toBe(201);
    expect(adj.body.data.quantity).toBe(-2);
    expect(adj.body.data.balanceAfter).toBe(18);
  });

  it('dispatch in_transit issues stock once, at cost; cancel returns it', async () => {
    const wh = org.users.warehouse!.agent;
    const d = await wh.post('/api/v1/dispatches').send({ projectId: project.id, items: [{ itemId, quantity: 4 }], scheduledDate: '2026-10-01' });
    expect(d.status).toBe(201);
    expect(d.body.data.code).toBe('D-0001');
    expect(d.body.data.project.code).toBe(project.code);

    const t1 = await wh.post(`/api/v1/dispatches/${d.body.data.id}/status`).send({ status: 'in_transit' });
    expect(t1.status).toBe(200);
    const t2 = await wh.post(`/api/v1/dispatches/${d.body.data.id}/status`).send({ status: 'delivered' });
    expect(t2.status).toBe(200);
    const outs = await StockMovement.find({ dispatchId: d.body.data.id, type: 'out' }).lean();
    expect(outs).toHaveLength(1);
    expect(outs[0]!.unitCost).toBe(150);
    expect((await wh.get('/api/v1/inventory/items')).body.data[0].quantity).toBe(14);

    const fin = await org.owner.get(`/api/v1/projects/${project.id}/financials`);
    expect(fin.body.data.materialCost).toBe(600);

    const back = await wh.post(`/api/v1/dispatches/${d.body.data.id}/status`).send({ status: 'packed' });
    expect(back.status).toBe(409);

    const c = await wh.post(`/api/v1/dispatches/${d.body.data.id}/status`).send({ status: 'cancelled' });
    expect(c.status).toBe(200);
    expect((await wh.get('/api/v1/inventory/items')).body.data[0].quantity).toBe(18);
    const fin2 = await org.owner.get(`/api/v1/projects/${project.id}/financials`);
    expect(fin2.body.data.materialCost).toBe(0);
    expect(c.body.data.history.map((h: any) => h.status)).toEqual(['planned', 'in_transit', 'delivered', 'cancelled']);
  });

  it('dispatch fails with 409 when stock is short and leaves stock untouched', async () => {
    const wh = org.users.warehouse!.agent;
    const d = await wh.post('/api/v1/dispatches').send({ projectId: project.id, items: [{ itemId, quantity: 50 }], scheduledDate: '2026-10-01' });
    const res = await wh.post(`/api/v1/dispatches/${d.body.data.id}/status`).send({ status: 'in_transit' });
    expect(res.status).toBe(409);
    expect((await wh.get('/api/v1/inventory/items')).body.data[0].quantity).toBe(18);
    expect((await wh.get(`/api/v1/dispatches/${d.body.data.id}`)).body.data.status).toBe('planned');
  });

  it('reserved = BOQ of active projects not yet dispatched; summary + low stock', async () => {
    await Project.updateOne({ _id: project.id }, { $set: { boqReserved: true, boq: [{ itemId, description: 'Inverter', quantity: 17, unit: 'nos', unitCost: 150 }] } });
    const items = await org.owner.get('/api/v1/inventory/items?lowStock=true');
    expect(items.body.data).toHaveLength(1);
    expect(items.body.data[0]).toMatchObject({ reserved: 17, available: 1, lowStock: true });
    const summary = await org.owner.get('/api/v1/inventory/summary');
    expect(summary.body.data).toMatchObject({ totalItems: 1, totalValue: 2700 });
    expect(summary.body.data.lowStock).toHaveLength(1);
    expect(summary.body.data.byCategory[0]).toMatchObject({ category: 'inverter', value: 2700, quantity: 18 });
    const mv = await org.owner.get(`/api/v1/inventory/movements?itemId=${itemId}`);
    expect(mv.body.meta.total).toBeGreaterThanOrEqual(5);
    expect(mv.body.data[0].item.sku).toBe('INV-5K');
  });
});

describe('finance', () => {
  let org: TestOrg;
  let p1: any;
  let p2: any;

  beforeAll(async () => {
    org = await orgWithTeam(['accounts', 'engineer', 'sales']);
    p1 = await createProject(org.owner, { contractValue: 200000 });
    p2 = await createProject(org.owner, { contractValue: 100000 });
    await org.owner.put('/api/v1/org/partners').send({
      partners: [
        { name: 'Owner', sharePercent: 40 },
        { name: 'Partner B', sharePercent: 30 },
        { name: 'Partner C', sharePercent: 30 },
      ],
    });
  });

  it('partners must add up to 100%', async () => {
    const res = await org.owner.put('/api/v1/org/partners').send({ partners: [{ name: 'A', sharePercent: 50 }] });
    expect(res.status).toBe(400);
  });

  it('expenses: engineer pending, approver auto-approved, decisions', async () => {
    const eng = org.users.engineer!;
    await org.owner.patch(`/api/v1/projects/${p1.id}`).send({ team: { engineerId: eng.id } });
    const e1 = await eng.agent.post('/api/v1/expenses').send({ projectId: p1.id, category: 'labour', amount: 5000, description: 'Crew wages' });
    expect(e1.status).toBe(201);
    expect(e1.body.data.status).toBe('pending');
    const e2 = await org.users.accounts!.agent.post('/api/v1/expenses').send({ projectId: p1.id, category: 'transport', amount: 3000, description: 'Truck' });
    expect(e2.body.data.status).toBe('approved');
    const e3 = await eng.agent.post('/api/v1/expenses').send({ projectId: p1.id, category: 'misc', amount: 999, description: 'Snacks' });
    await org.users.accounts!.agent.post(`/api/v1/expenses/${e3.body.data.id}/decision`).send({ status: 'rejected', note: 'Not reimbursable' });
    const again = await org.users.accounts!.agent.post(`/api/v1/expenses/${e3.body.data.id}/decision`).send({ status: 'approved' });
    expect(again.status).toBe(409);
    // engineers only see their own
    const mine = await eng.agent.get('/api/v1/expenses');
    expect(mine.body.data.map((x: any) => x.id).sort()).toEqual([e1.body.data.id, e3.body.data.id].sort());
    // office expense not tied to a project
    await org.owner.post('/api/v1/expenses').send({ category: 'office', amount: 2000, description: 'Rent' });
  });

  it('dashboard totals, profit (approved expenses only) and partner split', async () => {
    const acc = org.users.accounts!.agent;
    await acc.post('/api/v1/payments').send({ projectId: p1.id, amount: 60000, mode: 'phonepe', type: 'advance' });
    await acc.post('/api/v1/payments').send({ projectId: p1.id, amount: 40000, mode: 'company_account' });
    await acc.post('/api/v1/payments').send({ projectId: p2.id, amount: 100000, mode: 'cash', type: 'final' });
    const refund = await acc.post('/api/v1/payments').send({ projectId: p2.id, amount: 1000, mode: 'cash', type: 'refund' });
    const del = await acc.post('/api/v1/payments').send({ projectId: p2.id, amount: 5555, mode: 'upi' });
    await acc.delete(`/api/v1/payments/${del.body.data.id}`);
    expect(refund.status).toBe(201);
    await org.owner.post('/api/v1/advances').send({ personName: 'Partner B', kind: 'partner', amount: 10000 });
    const emp = await org.owner.post('/api/v1/advances').send({ personName: 'Ravi (driver)', kind: 'employee', amount: 2500 });
    const settled = await org.owner.post('/api/v1/advances').send({ personName: 'Old', kind: 'employee', amount: 999 });
    await org.owner.post(`/api/v1/advances/${settled.body.data.id}/settle`);
    expect(emp.status).toBe(201);

    const res = await org.owner.get('/api/v1/finance/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    // received: 60000 + 40000 + 100000 - 1000 = 199000; approved expenses: 5000? no (pending) → 3000 + 2000
    expect(d.totals).toMatchObject({ contractValue: 300000, received: 199000, expenses: 5000, materialCost: 0, advancesOutstanding: 12500, profit: 194000 });
    expect(d.totals.pending).toBe(101000); // p1: 100000, p2: 1000 (refund)
    expect(d.pendingCustomers.map((c: any) => c.code)).toEqual([p1.code, p2.code]);
    expect(d.pendingCustomers[0].lastPaymentAt).toBeTruthy();
    expect(d.receivedByMode).toEqual(
      expect.arrayContaining([
        { mode: 'phonepe', amount: 60000 },
        { mode: 'company_account', amount: 40000 },
        { mode: 'cash', amount: 99000 },
      ]),
    );
    expect(d.expensesByCategory).toEqual(expect.arrayContaining([{ category: 'transport', amount: 3000 }, { category: 'office', amount: 2000 }]));
    expect(d.advances).toEqual(expect.arrayContaining([{ personName: 'Partner B', kind: 'partner', outstanding: 10000 }]));
    expect(d.partnerSplit).toEqual([
      { name: 'Owner', sharePercent: 40, share: 77600, advanceTaken: 0, netPayable: 77600 },
      { name: 'Partner B', sharePercent: 30, share: 58200, advanceTaken: 10000, netPayable: 48200 },
      { name: 'Partner C', sharePercent: 30, share: 58200, advanceTaken: 0, netPayable: 58200 },
    ]);
    expect(d.monthly).toHaveLength(12);
    expect(d.monthly[11].received).toBe(199000);
    const pp = d.projectProfit.find((x: any) => x.projectId === p1.id);
    expect(pp).toMatchObject({ received: 100000, expenses: 3000, materialCost: 0, profit: 97000 });

    // accounts has finance:read but not finance:partners → no split
    const acct = await acc.get('/api/v1/finance/dashboard');
    expect(acct.body.data.partnerSplit).toEqual([]);
  });

  it('financials hide profit without finance:read; payments list filters', async () => {
    const sales = org.users.sales!.agent;
    const mine = await createProject(sales, { contractValue: 1000 });
    await org.users.accounts!.agent.post('/api/v1/payments').send({ projectId: mine.id, amount: 400, mode: 'upi' });
    const fin = await sales.get(`/api/v1/projects/${mine.id}/financials`);
    expect(fin.status).toBe(200);
    expect(fin.body.data).toMatchObject({ contractValue: 1000, received: 400, pending: 600 });
    expect(fin.body.data.profit).toBeUndefined();
    const list = await sales.get('/api/v1/payments');
    expect(list.body.data.map((x: any) => x.projectId)).toEqual([mine.id]);
    const byMode = await org.owner.get('/api/v1/payments?mode=cash');
    expect(byMode.body.data.every((x: any) => x.mode === 'cash')).toBe(true);
    expect(byMode.body.meta.totalAmount).toBe(99000);
  });

  it('CSV export', async () => {
    const res = await org.owner.get('/api/v1/reports/payments.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="payments-/);
    expect(res.text).toContain('Receipt,Date,Project');
    expect(res.text).toContain('R-');
    for (const kind of ['projects', 'leads', 'expenses', 'inventory', 'tickets']) {
      expect((await org.owner.get(`/api/v1/reports/${kind}.csv`)).status).toBe(200);
    }
    expect((await org.owner.get('/api/v1/reports/unknown.csv')).status).toBe(404);
    expect((await org.users.sales!.agent.get('/api/v1/reports/projects.csv')).status).toBe(403);
  });
});
