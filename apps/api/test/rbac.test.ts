import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApp, PASSWORD, createProject, orgWithTeam, addUser, type TestOrg } from './helpers';

describe('RBAC, features and row-level scoping', () => {
  let org: TestOrg;

  beforeAll(async () => {
    org = await orgWithTeam(['sales', 'engineer', 'accounts', 'manager', 'service']);
  });

  it('permissions gate routes with FORBIDDEN', async () => {
    const sales = org.users.sales!.agent;
    const res = await sales.get('/api/v1/finance/dashboard');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await sales.post('/api/v1/roles').send({ key: 'x_role', name: 'X Role', permissions: [] })).status).toBe(403);
    expect((await org.users.accounts!.agent.get('/api/v1/finance/dashboard')).status).toBe(200);
  });

  it('disabled features return FEATURE_DISABLED', async () => {
    const res = await org.owner.get('/api/v1/amc'); // amc_contracts is off by default
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEATURE_DISABLED');
    await org.owner.put('/api/v1/org/features').send({ key: 'amc_contracts', enabled: true });
    expect((await org.owner.get('/api/v1/amc')).status).toBe(200);
  });

  it('role-restricted features only apply to listed roles (owner always allowed)', async () => {
    await org.owner.put('/api/v1/org/features').send({ key: 'leads_crm', enabled: true, roles: ['manager'] });
    expect((await org.users.sales!.agent.get('/api/v1/leads')).body.error.code).toBe('FEATURE_DISABLED');
    expect((await org.users.manager!.agent.get('/api/v1/leads')).status).toBe(200);
    expect((await org.owner.get('/api/v1/leads')).status).toBe(200);
    const me = await org.users.sales!.agent.get('/api/v1/auth/me');
    expect(me.body.data.features.leads_crm).toBe(false);
    await org.owner.put('/api/v1/org/features').send({ key: 'leads_crm', enabled: true, roles: [] });
  });

  it('platform-locked features cannot be enabled by the org', async () => {
    const root = request.agent(getApp());
    await root.post('/api/v1/auth/login').send({ email: 'root@solarflow.test', password: 'RootPass123' });
    const upd = await root.patch(`/api/v1/platform/orgs/${org.orgId}`).send({ plan: 'growth', features: { quotations: { enabled: false, lockedByPlatform: true } } });
    expect(upd.status).toBe(200);
    expect(upd.body.data.features.find((f: any) => f.key === 'quotations')).toMatchObject({ enabled: false, lockedByPlatform: true });
    const res = await org.owner.put('/api/v1/org/features').send({ key: 'quotations', enabled: true });
    expect(res.status).toBe(403);
    await root.patch(`/api/v1/platform/orgs/${org.orgId}`).send({ features: { quotations: { enabled: true, lockedByPlatform: false } } });
  });

  it('suspended orgs are locked out', async () => {
    const root = request.agent(getApp());
    await root.post('/api/v1/auth/login').send({ email: 'root@solarflow.test', password: 'RootPass123' });
    const other = await orgWithTeam([]);
    await root.patch(`/api/v1/platform/orgs/${other.orgId}`).send({ isActive: false });
    expect((await other.owner.get('/api/v1/projects')).status).toBe(403);
    await root.patch(`/api/v1/platform/orgs/${other.orgId}`).send({ isActive: true });
    expect((await other.owner.get('/api/v1/projects')).status).toBe(200);
  });

  it('users without projects:read_all only see their projects', async () => {
    const mine = await createProject(org.users.sales!.agent);
    const other = await createProject(org.owner);
    const list = await org.users.sales!.agent.get('/api/v1/projects');
    const ids = list.body.data.map((p: any) => p.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(other.id);
    expect((await org.users.sales!.agent.get(`/api/v1/projects/${other.id}`)).status).toBe(404);
    // engineer: sees nothing until assigned
    expect((await org.users.engineer!.agent.get('/api/v1/projects')).body.data).toHaveLength(0);
    await org.owner.patch(`/api/v1/projects/${other.id}`).send({ team: { engineerId: org.users.engineer!.id } });
    expect((await org.users.engineer!.agent.get('/api/v1/projects')).body.data.map((p: any) => p.id)).toEqual([other.id]);
  });

  it('changing the team requires projects:assign', async () => {
    const p = await createProject(org.users.sales!.agent);
    const res = await org.users.sales!.agent.patch(`/api/v1/projects/${p.id}`).send({ team: { engineerId: org.users.engineer!.id } });
    expect(res.status).toBe(403);
  });

  it('leads: users without leads:assign only see their own', async () => {
    const mgr = org.users.manager!.agent;
    const other = await mgr.post('/api/v1/leads').send({ name: 'Manager Lead', phone: '9111111111' });
    const own = await org.users.sales!.agent.post('/api/v1/leads').send({ name: 'Sales Lead', phone: '9222222222' });
    expect(own.body.data.assignedTo.id).toBe(org.users.sales!.id);
    const list = await org.users.sales!.agent.get('/api/v1/leads');
    const ids = list.body.data.map((l: any) => l.id);
    expect(ids).toContain(own.body.data.id);
    expect(ids).not.toContain(other.body.data.id);
    const board = await mgr.get('/api/v1/leads/board');
    expect(Object.keys(board.body.data)).toContain('new');
  });

  it('customer portal user sees only their project and can raise tickets', async () => {
    const p = await createProject(org.owner, { customer: { name: 'Portal Customer', phone: '9333333333', email: 'portal.cust@test.dev' } });
    const access = await org.owner.post(`/api/v1/projects/${p.id}/customer-access`);
    expect(access.status).toBe(201);
    const token = access.body.data.inviteUrl.split('/invite/')[1];
    const cust = request.agent(getApp());
    const acc = await cust.post('/api/v1/auth/accept-invite').send({ token, name: 'Portal Customer', password: PASSWORD });
    expect(acc.status).toBe(200);
    expect(acc.body.data.role.key).toBe('customer');
    const list = await cust.get('/api/v1/projects');
    expect(list.body.data.map((x: any) => x.id)).toEqual([p.id]);
    const t = await cust.post('/api/v1/tickets').send({ projectId: p.id, subject: 'Low generation', description: 'Generation dropped', priority: 'high' });
    expect(t.status).toBe(201);
    // customer cannot assign or change priority
    expect((await cust.patch(`/api/v1/tickets/${t.body.data.id}`).send({ priority: 'low' })).status).toBe(403);
    expect((await cust.patch(`/api/v1/tickets/${t.body.data.id}`).send({ status: 'closed' })).status).toBe(403);
    // staff resolves, customer closes
    await org.owner.patch(`/api/v1/tickets/${t.body.data.id}`).send({ status: 'resolved', resolution: 'Cleaned panels' });
    const closed = await cust.patch(`/api/v1/tickets/${t.body.data.id}`).send({ status: 'closed' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('closed');
    // a second customer user never sees it
    await addUser(org, 'customer');
    expect((await org.users.customer!.agent.get('/api/v1/tickets')).body.data).toHaveLength(0);
    expect((await org.users.customer!.agent.get('/api/v1/projects')).body.data).toHaveLength(0);
  });

  it('roles: custom role CRUD, owner immutable, system undeletable', async () => {
    const created = await org.owner.post('/api/v1/roles').send({ key: 'surveyor', name: 'Surveyor', permissions: ['dashboard:read', 'projects:read'] });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ key: 'surveyor', isSystem: false, userCount: 0 });
    const roles = await org.owner.get('/api/v1/roles');
    const owner = roles.body.data.find((r: any) => r.key === 'owner');
    expect((await org.owner.patch(`/api/v1/roles/${owner.id}`).send({ permissions: [] })).status).toBe(403);
    expect((await org.owner.delete(`/api/v1/roles/${owner.id}`)).status).toBe(409);
    const upd = await org.owner.patch(`/api/v1/roles/${created.body.data.id}`).send({ name: 'Site Surveyor' });
    expect(upd.body.data.description).toBe('');
    expect(upd.body.data.name).toBe('Site Surveyor');
    expect((await org.owner.delete(`/api/v1/roles/${created.body.data.id}`)).status).toBe(200);
    const perms = await org.users.sales!.agent.get('/api/v1/permissions');
    expect(perms.body.data.groups).toHaveProperty('leads');
  });
});
