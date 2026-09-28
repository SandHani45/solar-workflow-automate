import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STAGES, TICKET_SLA_HOURS } from '@solar/shared';
import { Ticket } from '../src/modules/tickets/model';
import { planVisits } from '../src/modules/amc/service';
import { PDF, PNG, api, createProject, getApp, orgWithTeam, type TestOrg } from './helpers';

describe('service tickets & AMC', () => {
  let org: TestOrg;
  let project: any;

  beforeAll(async () => {
    org = await orgWithTeam(['service', 'engineer', 'manager']);
    project = await createProject(org.owner);
  });

  it('creates tickets with code, SLA dueAt and computed overdue', async () => {
    const res = await org.owner.post('/api/v1/tickets').send({ projectId: project.id, subject: 'Inverter error E03', description: 'Inverter shows E03', priority: 'critical', category: 'inverter_error' });
    expect(res.status).toBe(201);
    const t = res.body.data;
    expect(t.code).toBe('T-0001');
    expect(t.project).toEqual({ code: project.code, customerName: project.customer.name });
    const sla = new Date(t.dueAt).getTime() - new Date(t.createdAt).getTime();
    expect(Math.round(sla / 3_600_000)).toBe(TICKET_SLA_HOURS.critical);
    expect(t.overdue).toBe(false);
    await Ticket.updateOne({ _id: t.id }, { $set: { dueAt: new Date(Date.now() - 1000) } });
    const again = await org.owner.get(`/api/v1/tickets/${t.id}`);
    expect(again.body.data.overdue).toBe(true);
    expect(again.body.data.comments).toEqual([]);
    const overdue = await org.owner.get('/api/v1/tickets?overdue=true');
    expect(overdue.body.data).toHaveLength(1);
  });

  it('assignment needs tickets:assign; service sees assigned/unassigned only', async () => {
    const t = (await org.owner.post('/api/v1/tickets').send({ projectId: project.id, subject: 'Panel cleaning', description: 'Please clean', priority: 'low' })).body.data;
    const svc = org.users.service!;
    expect((await svc.agent.patch(`/api/v1/tickets/${t.id}`).send({ assigneeId: svc.id })).status).toBe(403);
    const assigned = await org.users.manager!.agent.patch(`/api/v1/tickets/${t.id}`).send({ assigneeId: svc.id });
    expect(assigned.body.data.status).toBe('assigned');
    expect(assigned.body.data.assignee.id).toBe(svc.id);
    const other = (await org.owner.post('/api/v1/tickets').send({ projectId: project.id, subject: 'Meter issue', description: 'Meter blank' })).body.data;
    await org.users.manager!.agent.patch(`/api/v1/tickets/${other.id}`).send({ assigneeId: org.users.engineer!.id });
    const visible = (await svc.agent.get('/api/v1/tickets')).body.data.map((x: any) => x.id);
    expect(visible).toContain(t.id);
    expect(visible).not.toContain(other.id);
    const c = await svc.agent.post(`/api/v1/tickets/${t.id}/comments`).send({ body: 'On my way' });
    expect(c.status).toBe(201);
    expect(c.body.data.comments[0].by.id).toBe(svc.id);
    const resolved = await svc.agent.patch(`/api/v1/tickets/${t.id}`).send({ status: 'resolved', resolution: 'Cleaned' });
    expect(resolved.body.data.resolvedAt).toBeTruthy();
  });

  it('AMC visits are generated evenly and can be marked done', async () => {
    const days = planVisits(new Date('2026-01-01'), new Date('2027-01-01'), 4).map((d) => d.toISOString().slice(0, 10));
    expect(days).toHaveLength(4);
    expect(days[0]! < days[1]! && days[1]! < days[2]! && days[2]! < days[3]!).toBe(true);

    await org.owner.put('/api/v1/org/features').send({ key: 'amc_contracts', enabled: true });
    const res = await org.owner.post('/api/v1/amc').send({ projectId: project.id, startDate: '2026-01-01', endDate: '2027-12-31', visitsPerYear: 4, amount: 6000 });
    expect(res.status).toBe(201);
    expect(res.body.data.visits).toHaveLength(8);
    const v = res.body.data.visits[0];
    const done = await org.users.service!.agent.patch(`/api/v1/amc/${res.body.data.id}/visits/${v.id}`).send({ done: true, note: 'Cleaned' });
    expect(done.status).toBe(200);
    expect(done.body.data.visits[0]).toMatchObject({ done: true, note: 'Cleaned' });
    expect(done.body.data.visitsDone).toBe(1);
    const list = await org.owner.get(`/api/v1/amc?projectId=${project.id}`);
    expect(list.body.data).toHaveLength(1);
  });
});

describe('quotations, documents, workflow config, misc', () => {
  let org: TestOrg;
  let project: any;

  beforeAll(async () => {
    org = await orgWithTeam(['sales', 'manager', 'engineer']);
    project = await createProject(org.users.sales!.agent);
  });

  it('quotations: totals, versions, supersede, approve sets contract value', async () => {
    const sales = org.users.sales!.agent;
    const body = { projectId: project.id, kind: 'final', systemSizeKw: 5, lines: [{ description: 'Solar kit', quantity: 1, unitPrice: 250000, gstPercent: 12 }], discount: 5000 };
    const q1 = await sales.post('/api/v1/quotations').send(body);
    expect(q1.status).toBe(201);
    expect(q1.body.data).toMatchObject({ number: expect.stringMatching(/^Q-\d{4}-0001$/), version: 1, status: 'draft', subtotal: 250000, gstTotal: 30000, grandTotal: 275000 });
    expect(q1.body.data.org.name).toBeTruthy();
    const patched = await sales.patch(`/api/v1/quotations/${q1.body.data.id}`).send({ discount: 0 });
    expect(patched.body.data.grandTotal).toBe(280000);
    expect(patched.body.data.kind).toBe('final'); // not reset by schema defaults
    await sales.post(`/api/v1/quotations/${q1.body.data.id}/status`).send({ status: 'sent' });
    expect((await sales.patch(`/api/v1/quotations/${q1.body.data.id}`).send({ discount: 1 })).status).toBe(409);

    const q2 = await sales.post('/api/v1/quotations').send({ ...body, discount: 10000 });
    expect(q2.body.data.version).toBe(2);
    await sales.post(`/api/v1/quotations/${q2.body.data.id}/status`).send({ status: 'sent' });
    expect((await sales.get(`/api/v1/quotations/${q1.body.data.id}`)).body.data.status).toBe('superseded');

    expect((await sales.post(`/api/v1/quotations/${q2.body.data.id}/status`).send({ status: 'accepted' })).status).toBe(403);
    const acc = await org.users.manager!.agent.post(`/api/v1/quotations/${q2.body.data.id}/status`).send({ status: 'accepted' });
    expect(acc.status).toBe(200);
    const p = (await org.owner.get(`/api/v1/projects/${project.id}`)).body.data;
    expect(p.contractValue).toBe(270000);
    const list = await sales.get(`/api/v1/quotations?projectId=${project.id}`);
    expect(list.body.meta.total).toBe(2);
  });

  it('documents: mimetype + content checks, download, delete', async () => {
    const sales = org.users.sales!.agent;
    const bad = await sales.post('/api/v1/documents').field('projectId', project.id).field('type', 'pan').attach('file', Buffer.from('MZ....'), { filename: 'x.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
    const spoof = await sales.post('/api/v1/documents').field('projectId', project.id).field('type', 'pan').attach('file', Buffer.from('not a pdf'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(spoof.status).toBe(400);
    const noTarget = await sales.post('/api/v1/documents').field('type', 'pan').attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
    expect(noTarget.status).toBe(400);

    const ok = await sales.post('/api/v1/documents').field('projectId', project.id).field('type', 'pan').field('note', 'PAN card').attach('file', PDF, { filename: 'pan card.pdf', contentType: 'application/pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ type: 'pan', originalName: 'pan card.pdf', mimeType: 'application/pdf', url: `/api/v1/documents/${ok.body.data.id}/download` });
    expect(ok.body.data.storageKey).toBeUndefined();
    expect(ok.body.data.uploadedBy.id).toBe(org.users.sales!.id);

    const dl = await sales.get(ok.body.data.url).buffer(true);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/attachment; filename="pan card.pdf"/);
    expect(Buffer.from(dl.body).toString('latin1').startsWith('%PDF-')).toBe(true);

    const list = await sales.get(`/api/v1/documents?projectId=${project.id}&type=pan`);
    expect(list.body.data).toHaveLength(1);
    expect((await sales.delete(`/api/v1/documents/${ok.body.data.id}`)).status).toBe(403); // sales lacks documents:delete
    expect((await org.owner.delete(`/api/v1/documents/${ok.body.data.id}`)).status).toBe(200);
    expect((await sales.get(ok.body.data.url)).status).toBe(404);
  });

  it('workflow customisation bumps version; projects keep their snapshot', async () => {
    const wf = (await org.owner.get('/api/v1/org/workflow')).body.data;
    expect(wf.version).toBe(1);
    expect(wf.phases).toHaveLength(7);
    const stages = wf.stages.map((s: any) => (s.key === 'site_survey' ? { ...s, name: 'Roof Survey' } : s));
    const cyc = await org.owner.put('/api/v1/org/workflow').send({ stages: stages.map((s: any) => (s.key === 'quotation_sent' ? { ...s, dependsOn: ['project_closure'] } : s)) });
    expect(cyc.status).toBe(400);
    expect(cyc.body.error.message).toMatch(/cycle/);
    const put = await org.owner.put('/api/v1/org/workflow').send({ stages });
    expect(put.status).toBe(200);
    expect(put.body.data.version).toBe(2);
    const newP = await createProject(org.owner);
    expect(newP.workflowVersion).toBe(2);
    expect(newP.stageDefinitions.find((s: any) => s.key === 'site_survey').name).toBe('Roof Survey');
    const oldP = (await org.owner.get(`/api/v1/projects/${project.id}`)).body.data;
    expect(oldP.workflowVersion).toBe(1);
    const reset = await org.owner.post('/api/v1/org/workflow/reset');
    expect(reset.body.data.version).toBe(3);
    expect(reset.body.data.stages).toHaveLength(DEFAULT_STAGES.length);
    expect((await org.users.sales!.agent.put('/api/v1/org/workflow').send({ stages })).status).toBe(403);
  });

  it('org settings, users, options, notifications, search, audit, dashboard', async () => {
    const s = await org.owner.patch('/api/v1/org').send({ advancePercent: 40, gstin: '24ABCDE1234F1Z5' });
    expect(s.body.data.settings).toMatchObject({ advancePercent: 40, gstin: '24ABCDE1234F1Z5' });
    const opts = await org.users.sales!.agent.get('/api/v1/users/options?role=engineer');
    expect(opts.body.data).toEqual([{ id: org.users.engineer!.id, name: 'engineer user', roleKey: 'engineer', email: org.users.engineer!.email }]);
    const users = await org.owner.get('/api/v1/users?roleKey=sales');
    expect(users.body.data).toHaveLength(1);
    expect(users.body.data[0].sessions).toBeUndefined();

    const notes = await org.users.manager!.agent.get('/api/v1/notifications');
    expect(notes.status).toBe(200);
    expect(notes.body.meta.unread).toBeGreaterThan(0);
    const first = notes.body.data[0];
    await org.users.manager!.agent.post(`/api/v1/notifications/${first.id}/read`);
    await org.users.manager!.agent.post('/api/v1/notifications/read-all');
    expect((await org.users.manager!.agent.get('/api/v1/notifications?unread=true')).body.data).toHaveLength(0);

    const search = await org.owner.get(`/api/v1/search?q=${encodeURIComponent(project.code)}`);
    expect(search.body.data.projects[0].code).toBe(project.code);

    const audit = await org.owner.get('/api/v1/audit?entity=project');
    expect(audit.status).toBe(200);
    expect(audit.body.data.length).toBeGreaterThan(0);
    expect(audit.body.data[0].user.name).toBeTruthy();
    expect((await org.users.sales!.agent.get('/api/v1/audit')).status).toBe(403);

    const dash = await org.owner.get('/api/v1/dashboard');
    expect(dash.body.data.monthlyCollections).toHaveLength(6);
    expect(dash.body.data.recentActivity.length).toBeGreaterThan(0);
    expect(dash.body.data.kpis).toHaveProperty('lowStockItems');

    const orgInfo = await org.users.sales!.agent.get('/api/v1/org');
    expect(orgInfo.body.data.partners).toEqual([]);
    expect(orgInfo.body.data.features.leads_crm).toBe(true);
  });

  it('health, 404 envelope, unauthenticated envelope', async () => {
    const h = await api().get('/api/v1/health');
    expect(h.status).toBe(200);
    expect(h.body.data).toMatchObject({ status: 'ok', db: 'up' });
    const nf = await api().get('/api/v1/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    const un = await api().get('/api/v1/projects');
    expect(un.status).toBe(401);
    expect(un.body.error.code).toBe('UNAUTHENTICATED');
    const badId = await org.owner.get('/api/v1/projects/not-an-id');
    expect(badId.status).toBe(404);
  });

  it('platform: orgs list/detail and feature catalogue', async () => {
    const root = request.agent(getApp());
    await root.post('/api/v1/auth/login').send({ email: 'root@solarflow.test', password: 'RootPass123' });
    const orgs = await root.get('/api/v1/platform/orgs');
    expect(orgs.body.meta.total).toBeGreaterThan(0);
    expect(orgs.body.data[0].counts).toHaveProperty('users');
    const detail = await root.get(`/api/v1/platform/orgs/${org.orgId}`);
    expect(detail.body.data.features).toHaveLength(18);
    const feats = await root.get('/api/v1/platform/features');
    expect(feats.body.data).toHaveLength(18);
    const upd = await root.patch('/api/v1/platform/features/amc_contracts').send({ defaultEnabled: true, name: 'AMC' });
    expect(upd.body.data).toMatchObject({ key: 'amc_contracts', defaultEnabled: true, name: 'AMC' });
    // org without override now follows the new default
    expect((await org.owner.get('/api/v1/auth/me')).body.data.features.amc_contracts).toBe(true);
    await root.patch('/api/v1/platform/features/amc_contracts').send({ defaultEnabled: false, name: 'AMC Contracts' });
  });
});
