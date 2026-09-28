import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STAGES } from '@solar/shared';
import { Dispatch } from '../src/modules/dispatches/model';
import { Lead } from '../src/modules/leads/model';
import { Notification } from '../src/modules/notifications/model';
import { Project } from '../src/modules/projects/model';
import { allDone, completeStage, createProject, orgWithTeam, stage, uploadDoc, type TestOrg } from './helpers';

const SURVEY = { surveyDate: '2026-09-01', roofType: 'rcc', floors: 2, shadowFreeAreaSqft: 600 };
const QUOTE = { proposedKw: 5, quotedAmount: 300000 };
const FINAL = { finalKw: 5.4, contractValue: 300000, orderDate: '2026-09-05' };

describe('workflow engine', () => {
  let org: TestOrg;
  let project: any;
  let leadId: string;

  beforeAll(async () => {
    org = await orgWithTeam();
    const sales = org.users.sales!.agent;
    const lead = await sales.post('/api/v1/leads').send({ name: 'Ramesh Patel', phone: '9876543210', email: 'ramesh@cust.dev', source: 'referral' });
    expect(lead.status).toBe(201);
    leadId = lead.body.data.id;
    expect(lead.body.data.code).toMatch(/^L-\d{5}$/);
    const conv = await sales.post(`/api/v1/leads/${leadId}/convert`).send({ systemSizeKw: 5 });
    expect(conv.status).toBe(201);
    project = conv.body.data;
  });

  it('initialises stages from the org workflow: only roots available, with dueAt', () => {
    expect(project.code).toMatch(/^SP-\d{4}-\d{4}$/);
    expect(project.stageDefinitions).toHaveLength(DEFAULT_STAGES.length);
    expect(stage(project, 'quotation_sent').status).toBe('pending');
    expect(stage(project, 'quotation_sent').dueAt).toBeTruthy();
    expect(stage(project, 'site_survey').status).toBe('locked');
    expect(stage(project, 'project_closure').status).toBe('locked');
    expect(project.progress).toBe(0);
    expect(project.currentPhase).toBe('sales');
    expect(project.team.sales.id).toBe(org.users.sales!.id);
  });

  it('rejects a locked stage and a wrong role, reporting every reason', async () => {
    const res = await org.users.warehouse!.agent.patch(`/api/v1/projects/${project.id}/stages/site_survey`).send({ status: 'completed' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('STAGE_RULE');
    const reasons: string[] = res.body.error.details.reasons;
    expect(reasons.some((r) => /locked/i.test(r))).toBe(true);
    expect(reasons.some((r) => /role \(warehouse\)/i.test(r))).toBe(true);
    // Rule-3 reasons are collected too (checklist, fields, documents).
    expect(reasons.some((r) => /Survey Photo/.test(r))).toBe(true);
    expect(reasons.some((r) => /checklist/i.test(r))).toBe(true);
  });

  it('rejects completion with missing checklist and required fields', async () => {
    const res = await org.users.sales!.agent.patch(`/api/v1/projects/${project.id}/stages/quotation_sent`).send({ status: 'completed', data: { proposedKw: 5 } });
    expect(res.status).toBe(422);
    const reasons: string[] = res.body.error.details.reasons;
    expect(reasons.some((r) => r.startsWith('Complete the checklist'))).toBe(true);
    expect(reasons.some((r) => r.includes('Quoted amount'))).toBe(true);
    expect(reasons.some((r) => r.includes('Proposed system size'))).toBe(false);
  });

  it('partial updates move a pending stage to in_progress and keep data', async () => {
    const res = await org.users.sales!.agent.patch(`/api/v1/projects/${project.id}/stages/quotation_sent`).send({ data: { monthlyUnits: '450' }, note: 'Customer wants 5 kW' });
    expect(res.status).toBe(200);
    const s = stage(res.body.data, 'quotation_sent');
    expect(s.status).toBe('in_progress');
    expect(s.data.monthlyUnits).toBe(450);
    expect(s.notes[0].body).toBe('Customer wants 5 kW');
    expect(s.notes[0].by.id).toBe(org.users.sales!.id);
  });

  it('completes a stage, unlocks dependants with dueAt and notifies owners', async () => {
    project = await completeStage(org.users.sales!.agent, project, 'quotation_sent', QUOTE);
    expect(stage(project, 'quotation_sent').status).toBe('completed');
    expect(stage(project, 'quotation_sent').completedBy.id).toBe(org.users.sales!.id);
    const survey = stage(project, 'site_survey');
    expect(survey.status).toBe('pending');
    const due = new Date(survey.dueAt).getTime();
    expect(due).toBeGreaterThan(Date.now() + 2.9 * 86_400_000);
    expect(due).toBeLessThan(Date.now() + 3.1 * 86_400_000);
    expect(project.progress).toBe(Math.round((1 / DEFAULT_STAGES.length) * 100));
    // manager owns site_survey and can see all projects → notified
    expect(await Notification.countDocuments({ userId: org.users.manager!.id, title: /Site Survey/ })).toBe(1);
  });

  it('requires documents, then copies survey data into the project', async () => {
    const miss = await org.users.sales!.agent
      .patch(`/api/v1/projects/${project.id}/stages/site_survey`)
      .send({ status: 'completed', checklist: allDone(project, 'site_survey'), data: SURVEY });
    expect(miss.status).toBe(422);
    expect(miss.body.error.details.reasons).toEqual(['Upload required documents: Survey Photo']);

    await uploadDoc(org.users.sales!.agent, project.id, 'survey_photo', 'site_survey');
    project = await completeStage(org.users.sales!.agent, project, 'site_survey', SURVEY);
    expect(project.survey).toMatchObject({ roofType: 'rcc', floors: 2, shadowFreeAreaSqft: 600 });
    expect(project.documentsCount).toBe(1);
  });

  it('validates field types (select options)', async () => {
    const res = await org.users.sales!.agent
      .patch(`/api/v1/projects/${project.id}/stages/final_quotation`)
      .send({ status: 'completed', checklist: allDone(project, 'final_quotation'), data: { ...FINAL, finalKw: 'lots' } });
    expect(res.status).toBe(422);
    expect(res.body.error.details.reasons).toContain('Final system size (kW) must be a number');
  });

  it('final quotation copies contract value/size, marks lead won and unlocks parallel tracks', async () => {
    project = await completeStage(org.users.sales!.agent, project, 'final_quotation', FINAL);
    expect(project.contractValue).toBe(300000);
    expect(project.systemSizeKw).toBe(5.4);
    for (const k of ['documents_collection', 'boq_preparation', 'advance_payment']) expect(stage(project, k).status).toBe('pending');
    expect(stage(project, 'material_check').status).toBe('locked');
    expect(project.currentPhase).toBe('documentation');
    const lead = await Lead.findById(leadId).lean();
    expect(lead!.status).toBe('won');
    expect(String(lead!.projectId)).toBe(project.id);
  });

  it('enforces the advance payment percentage', async () => {
    const sales = org.users.sales!.agent;
    const attempt = () => sales.patch(`/api/v1/projects/${project.id}/stages/advance_payment`).send({ status: 'completed', checklist: allDone(project, 'advance_payment') });
    let res = await attempt();
    expect(res.status).toBe(422);
    expect(res.body.error.details.reasons[0]).toMatch(/Advance of 30%/);

    const accounts = org.users.accounts!.agent;
    const pay = await accounts.post('/api/v1/payments').send({ projectId: project.id, amount: 50000, mode: 'upi', type: 'advance' });
    expect(pay.status).toBe(201);
    expect(pay.body.data.receiptNo).toMatch(/^R-\d{4}-0001$/);
    res = await attempt();
    expect(res.status).toBe(422);

    await accounts.post('/api/v1/payments').send({ projectId: project.id, amount: 40000, mode: 'cash', type: 'advance' });
    res = await attempt();
    expect(res.status).toBe(200);
    project = res.body.data;
    expect(project.financialSummary).toEqual({ received: 90000, pending: 210000 });
    expect(stage(project, 'engineer_allocation').status).toBe('pending');
  });

  it('only optional stages can be skipped', async () => {
    const ops = org.users.operations!.agent;
    const bad = await ops.patch(`/api/v1/projects/${project.id}/stages/boq_preparation`).send({ status: 'skipped' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.reasons).toContain('Only optional stages can be skipped');

    for (const t of ['aadhaar', 'pan', 'bank_passbook', 'electricity_bill']) await uploadDoc(ops, project.id, t, 'documents_collection');
    project = await completeStage(ops, project, 'documents_collection', { consumerNumber: 'GJ-123456' });
    expect(project.customer.consumerNumber).toBe('GJ-123456');
    const skip = await ops.patch(`/api/v1/projects/${project.id}/stages/subsidy_loan`).send({ status: 'skipped' });
    expect(skip.status).toBe(200);
    project = skip.body.data;
    expect(stage(project, 'subsidy_loan').status).toBe('skipped');
  });

  it('assign_engineer validates the user and sets team.engineer', async () => {
    const mgr = org.users.manager!.agent;
    const wrong = await mgr
      .patch(`/api/v1/projects/${project.id}/stages/engineer_allocation`)
      .send({ status: 'completed', checklist: allDone(project, 'engineer_allocation'), data: { engineerId: org.users.sales!.id } });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.details.reasons[0]).toMatch(/must have role: engineer/);
    project = await completeStage(mgr, project, 'engineer_allocation', { engineerId: org.users.engineer!.id });
    expect(project.team.engineer.id).toBe(org.users.engineer!.id);
    // engineer now sees the project (row-level scope)
    expect((await org.users.engineer!.agent.get(`/api/v1/projects/${project.id}`)).status).toBe(200);
  });

  it('BOQ reservation and dispatch_planning creates a dispatch from the BOQ', async () => {
    const wh = org.users.warehouse!.agent;
    const item = await org.owner.post('/api/v1/inventory/items').send({ sku: 'MOD-540', name: 'Mono PERC 540W', category: 'module', costPrice: 11000 });
    expect(item.status).toBe(201);
    await wh.post('/api/v1/inventory/movements').send({ itemId: item.body.data.id, type: 'in', quantity: 20, unitCost: 11000 });
    const boq = await org.users.operations!.agent.put(`/api/v1/projects/${project.id}/boq`).send({ items: [{ itemId: item.body.data.id, description: 'Modules', quantity: 10, unitCost: 11000 }] });
    expect(boq.status).toBe(200);
    project = await completeStage(org.users.operations!.agent, boq.body.data, 'boq_preparation');
    const inv = await wh.get('/api/v1/inventory/items');
    expect(inv.body.data[0]).toMatchObject({ quantity: 20, reserved: 10, available: 10 });

    project = await completeStage(wh, project, 'material_check');
    project = await completeStage(wh, project, 'dispatch_planning', { dispatchDate: '2026-09-20', vehicleNo: 'GJ01AB1234' });
    const dispatches = await Dispatch.find({ projectId: project.id }).lean();
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]!.code).toBe('D-0001');
    expect(dispatches[0]!.items[0]!.quantity).toBe(10);
    // parallel join: installation_schedule needs engineer_allocation + dispatch_planning
    expect(stage(project, 'installation_schedule').status).toBe('pending');
  });

  it('set_installation_date automation', async () => {
    project = await completeStage(org.users.manager!.agent, project, 'installation_schedule', { installationDate: '2026-10-01' });
    expect(project.installationDate).toMatch(/^2026-10-01/);
  });

  it('reopen keeps completed dependants completed', async () => {
    const res = await org.owner.post(`/api/v1/projects/${project.id}/stages/final_quotation/reopen`);
    expect(res.status).toBe(200);
    expect(stage(res.body.data, 'final_quotation').status).toBe('in_progress');
    expect(stage(res.body.data, 'advance_payment').status).toBe('completed');
    const noOverride = await org.users.sales!.agent.post(`/api/v1/projects/${project.id}/stages/final_quotation/reopen`);
    expect(noOverride.status).toBe(403);
    // completed stage cannot be edited without reopening
    const edit = await org.users.sales!.agent.patch(`/api/v1/projects/${project.id}/stages/quotation_sent`).send({ data: { quotedAmount: 1 } });
    expect(edit.status).toBe(422);
    project = await completeStage(org.owner, res.body.data, 'final_quotation', FINAL);
  });

  it('closure requires full payment and closes the project', async () => {
    // Fast-forward: mark every stage except closure as completed.
    const doc = await Project.findById(project.id).lean();
    const stages = doc!.stages.map((s) => (s.key === 'project_closure' ? { ...s, status: 'pending' as const } : { ...s, status: 'completed' as const }));
    await Project.updateOne({ _id: project.id }, { $set: { stages } });
    const fresh = (await org.owner.get(`/api/v1/projects/${project.id}`)).body.data;

    const acc = org.users.accounts!;
    // accounts owns the closure stage: passes RBAC, then hits the stage rules (checklist + full payment)
    const accRes = await acc.agent.patch(`/api/v1/projects/${project.id}/stages/project_closure`).send({ status: 'completed' });
    expect(accRes.status).toBe(422);
    expect(accRes.body.error.code).toBe('STAGE_RULE');

    const attempt = () => org.owner.patch(`/api/v1/projects/${project.id}/stages/project_closure`).send({ status: 'completed', checklist: allDone(fresh, 'project_closure') });
    let res = await attempt();
    expect(res.status).toBe(422);
    expect(res.body.error.details.reasons[0]).toMatch(/Full payment required/);

    await acc.agent.post('/api/v1/payments').send({ projectId: project.id, amount: 180000, mode: 'bank_transfer', type: 'final' });
    await acc.agent.post('/api/v1/payments').send({ projectId: project.id, amount: 30000, mode: 'subsidy_credit', type: 'subsidy' });
    res = await attempt();
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.completedAt).toBeTruthy();
    expect(res.body.data.progress).toBe(100);
    expect(res.body.data.currentPhase).toBe('closure');
  });

  it('writes an audit trail for stage changes', async () => {
    const tl = await org.owner.get(`/api/v1/projects/${project.id}/timeline`);
    expect(tl.status).toBe(200);
    const actions = tl.body.data.map((e: any) => e.action);
    expect(actions).toContain('stage.completed');
    expect(actions).toContain('stage.skipped');
    expect(actions).toContain('stage.reopen');
    expect(tl.body.data[0].user).toHaveProperty('name');
  });

  it('auto-skips stages whose feature is disabled (new and existing projects)', async () => {
    const existing = await createProject(org.owner);
    const off = await org.owner.put('/api/v1/org/features').send({ key: 'site_survey', enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.data.find((f: any) => f.key === 'site_survey').enabled).toBe(false);

    const p = await createProject(org.users.sales!.agent);
    expect(stage(p, 'site_survey').status).toBe('skipped');
    // existing project synced when features changed
    const again = (await org.owner.get(`/api/v1/projects/${existing.id}`)).body.data;
    expect(stage(again, 'site_survey').status).toBe('skipped');

    const done = await completeStage(org.owner, p, 'quotation_sent', QUOTE);
    expect(stage(done, 'final_quotation').status).toBe('pending');
    // disabled stage can't be worked on
    const res = await org.users.sales!.agent.patch(`/api/v1/projects/${p.id}/stages/site_survey`).send({ status: 'in_progress' });
    expect(res.status).toBe(422);

    // re-enabling restores auto-skipped stages
    await org.owner.put('/api/v1/org/features').send({ key: 'site_survey', enabled: true });
    const back = (await org.owner.get(`/api/v1/projects/${existing.id}`)).body.data;
    expect(stage(back, 'site_survey').status).toBe('locked');
  });

  it('dashboard myTasks lists stages owned by the caller role', async () => {
    const p = await createProject(org.users.sales!.agent);
    const dash = await org.users.sales!.agent.get('/api/v1/dashboard');
    expect(dash.status).toBe(200);
    const tasks = dash.body.data.myTasks.filter((t: any) => t.projectId === p.id);
    expect(tasks.map((t: any) => t.stageKey)).toEqual(['quotation_sent']);
    expect(dash.body.data.kpis.activeProjects).toBeGreaterThan(0);
    expect(dash.body.data.monthlyCollections).toEqual([]); // sales lacks finance:read
    expect(dash.body.data.projectsByPhase).toHaveLength(7);
  });
});
