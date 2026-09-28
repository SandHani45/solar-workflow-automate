import { beforeAll, describe, expect, it } from 'vitest';
import { Lead } from '../src/modules/leads/model';
import { Project } from '../src/modules/projects/model';
import { DocumentModel } from '../src/modules/documents/model';
import { createProject, registerOrg, uploadDoc, type TestOrg } from './helpers';

describe('multi-tenancy isolation', () => {
  let a: TestOrg;
  let b: TestOrg;
  let projectA: any;
  let leadA: any;
  let docA: any;

  beforeAll(async () => {
    a = await registerOrg('Tenant A');
    b = await registerOrg('Tenant B');
    projectA = await createProject(a.owner);
    leadA = (await a.owner.post('/api/v1/leads').send({ name: 'Lead Of A', phone: '9000000001' })).body.data;
    docA = await uploadDoc(a.owner, projectA.id, 'aadhaar');
  });

  it('org B cannot read org A project, lead or document', async () => {
    expect((await b.owner.get(`/api/v1/projects/${projectA.id}`)).status).toBe(404);
    expect((await b.owner.get(`/api/v1/leads/${leadA.id}`)).status).toBe(404);
    expect((await b.owner.get(`/api/v1/documents/${docA.id}/download`)).status).toBe(404);
    expect((await b.owner.get(`/api/v1/projects/${projectA.id}/financials`)).status).toBe(404);
    expect((await b.owner.get(`/api/v1/projects/${projectA.id}/timeline`)).status).toBe(404);
  });

  it('org B lists never include org A data', async () => {
    const [projects, leads, docs, search] = await Promise.all([
      b.owner.get('/api/v1/projects'),
      b.owner.get('/api/v1/leads'),
      b.owner.get(`/api/v1/documents?projectId=${projectA.id}`),
      b.owner.get('/api/v1/search?q=Lead Of A'),
    ]);
    expect(projects.body.data).toHaveLength(0);
    expect(leads.body.data).toHaveLength(0);
    expect(docs.body.data).toHaveLength(0);
    expect(search.body.data.leads).toHaveLength(0);
    // …while org A sees its own
    expect((await a.owner.get('/api/v1/projects')).body.data).toHaveLength(1);
  });

  it('org B cannot modify or delete org A data', async () => {
    expect((await b.owner.patch(`/api/v1/projects/${projectA.id}`).send({ systemSizeKw: 99 })).status).toBe(404);
    expect((await b.owner.patch(`/api/v1/projects/${projectA.id}/stages/quotation_sent`).send({ note: 'hi' })).status).toBe(404);
    expect((await b.owner.delete(`/api/v1/projects/${projectA.id}`)).status).toBe(404);
    expect((await b.owner.patch(`/api/v1/leads/${leadA.id}`).send({ name: 'Hacked' })).status).toBe(404);
    expect((await b.owner.delete(`/api/v1/leads/${leadA.id}`)).status).toBe(404);
    expect((await b.owner.delete(`/api/v1/documents/${docA.id}`)).status).toBe(404);
    expect((await b.owner.post('/api/v1/payments').send({ projectId: projectA.id, amount: 100, mode: 'cash' })).status).toBe(404);
    expect((await b.owner.post('/api/v1/tickets').send({ projectId: projectA.id, subject: 'Hello there', description: 'Nope nope' })).status).toBe(404);

    const p = await Project.findById(projectA.id).lean();
    expect(p!.systemSizeKw).toBe(5);
    expect(p!.deletedAt).toBeNull();
    expect((await Lead.findById(leadA.id).lean())!.name).toBe('Lead Of A');
    expect(await DocumentModel.exists({ _id: docA.id })).toBeTruthy();
  });

  it('client-supplied orgId is ignored', async () => {
    const res = await b.owner.post('/api/v1/leads').send({ name: 'Sneaky', phone: '9000000002', orgId: a.orgId });
    expect(res.status).toBe(201);
    const lead = await Lead.findById(res.body.data.id).lean();
    expect(String(lead!.orgId)).toBe(b.orgId);
  });

  it('sequence codes are per org', async () => {
    const pb = await createProject(b.owner);
    expect(pb.code).toBe(projectA.code);
  });
});
