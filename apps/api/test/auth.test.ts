import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLES, DEFAULT_STAGES } from '@solar/shared';
import { Org } from '../src/modules/org/model';
import { Role } from '../src/modules/roles/model';
import { User } from '../src/modules/users/model';
import { createPasswordResetToken } from '../src/modules/auth/service';
import { PASSWORD, addUser, api, getApp, registerOrg } from './helpers';

const cookieOf = (res: request.Response, name: string) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
};

describe('auth', () => {
  it('register creates org with default roles, workflow v1 and owner session', async () => {
    const res = await api().post('/api/v1/auth/register').send({ orgName: 'Sunrise Solar', name: 'Asha', email: 'asha@sunrise.dev', password: PASSWORD });
    expect(res.status).toBe(201);
    const s = res.body.data;
    expect(s.user).toMatchObject({ email: 'asha@sunrise.dev', roleKey: 'owner', isSuperAdmin: false });
    expect(s.user.passwordHash).toBeUndefined();
    expect(s.org).toMatchObject({ name: 'Sunrise Solar', slug: 'sunrise-solar', plan: 'starter' });
    expect(s.org.settings.advancePercent).toBe(30);
    expect(s.permissions).toEqual(expect.arrayContaining(ALL_PERMISSIONS));
    expect(s.features.leads_crm).toBe(true);
    expect(s.features.amc_contracts).toBe(false); // catalogue default
    expect(cookieOf(res, 'sf_access')).toMatch(/HttpOnly/i);
    expect(cookieOf(res, 'sf_refresh')).toMatch(/Path=\/api\/v1\/auth/);

    const org = await Org.findById(s.org.id).lean();
    expect(org!.workflow.version).toBe(1);
    expect(org!.workflow.stages).toHaveLength(DEFAULT_STAGES.length);
    expect(await Role.countDocuments({ orgId: s.org.id })).toBe(DEFAULT_ROLES.length);

    // Slugs stay unique; emails are unique.
    const again = await api().post('/api/v1/auth/register').send({ orgName: 'Sunrise Solar', name: 'Bob', email: 'bob@sunrise.dev', password: PASSWORD });
    expect(again.body.data.org.slug).toBe('sunrise-solar-2');
    const dup = await api().post('/api/v1/auth/register').send({ orgName: 'X Co', name: 'Bob', email: 'bob@sunrise.dev', password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('validates bodies with the error envelope', async () => {
    const res = await api().post('/api/v1/auth/register').send({ orgName: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fieldErrors).toHaveProperty('email');
    expect(res.body.error.details.fieldErrors).toHaveProperty('password');
  });

  it('rejects mongo operator keys in bodies', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: { $gt: '' }, password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login, me, logout', async () => {
    const org = await registerOrg();
    const me = await org.owner.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.role.key).toBe('owner');

    const email = me.body.data.user.email;
    const bad = await api().post('/api/v1/auth/login').send({ email, password: 'wrong-pass-1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHENTICATED');

    const agent = request.agent(getApp());
    expect((await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await agent.post('/api/v1/auth/logout')).body.data).toEqual({ ok: true });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await api().get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rotates refresh tokens and revokes every session on reuse', async () => {
    const org = await registerOrg();
    const first = await org.owner.post('/api/v1/auth/refresh');
    expect(first.status).toBe(200);
    const oldRefresh = cookieOf(first, 'sf_refresh')!.split(';')[0]!;

    // Second rotation makes `oldRefresh` stale.
    const second = await org.owner.post('/api/v1/auth/refresh');
    expect(second.status).toBe(200);

    // Age the rotation beyond the grace window, then replay the stale token.
    await User.updateOne({ _id: org.ownerId }, { $set: { 'sessions.$[].rotatedAt': new Date(Date.now() - 60_000) } });
    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', oldRefresh);
    expect(replay.status).toBe(401);
    const user = await User.findById(org.ownerId).lean();
    expect(user!.sessions).toHaveLength(0);
    // The legitimate agent is logged out too.
    expect((await org.owner.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('stores refresh tokens hashed', async () => {
    const org = await registerOrg();
    const res = await org.owner.post('/api/v1/auth/refresh');
    const token = decodeURIComponent(cookieOf(res, 'sf_refresh')!.split(';')[0]!.split('=')[1]!);
    const user = await User.findById(org.ownerId).lean();
    expect(JSON.stringify(user!.sessions)).not.toContain(token);
  });

  it('invite flow: create invite, describe, accept', async () => {
    const org = await registerOrg('Invite Co');
    const inv = await org.owner.post('/api/v1/users').send({ name: 'Sam Sales', email: 'sam@invite.dev', roleKey: 'sales' });
    expect(inv.status).toBe(201);
    const token = inv.body.data.inviteUrl.split('/invite/')[1];
    const stored = await User.findOne({ email: 'sam@invite.dev' }).lean();
    expect(stored!.inviteTokenHash).toBeDefined();
    expect(stored!.inviteTokenHash).not.toBe(token);

    const info = await api().get(`/api/v1/auth/invite/${token}`);
    expect(info.body.data).toMatchObject({ email: 'sam@invite.dev', orgName: 'Invite Co', roleName: 'Sales Executive' });

    // Invited users cannot log in before accepting.
    expect((await api().post('/api/v1/auth/login').send({ email: 'sam@invite.dev', password: PASSWORD })).status).toBe(401);

    const agent = request.agent(getApp());
    const acc = await agent.post('/api/v1/auth/accept-invite').send({ token, name: 'Sam S', password: PASSWORD });
    expect(acc.status).toBe(200);
    expect(acc.body.data.user.name).toBe('Sam S');
    expect(acc.body.data.role.key).toBe('sales');
    expect((await api().get(`/api/v1/auth/invite/${token}`)).status).toBe(404);
  });

  it('change and reset password', async () => {
    const org = await registerOrg();
    const me = (await org.owner.get('/api/v1/auth/me')).body.data.user;
    const wrong = await org.owner.post('/api/v1/auth/change-password').send({ currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(wrong.status).toBe(400);
    const ok = await org.owner.post('/api/v1/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: me.email, password: 'NewPass123' })).status).toBe(200);

    expect((await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@nowhere.dev' })).body.data).toEqual({ ok: true });
    const token = await createPasswordResetToken(me.email);
    expect(token).toBeTruthy();
    const reset = await api().post('/api/v1/auth/reset-password').send({ token, password: 'Reset1234' });
    expect(reset.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: me.email, password: 'Reset1234' })).status).toBe(200);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, password: 'Reset1234' })).status).toBe(404);
  });

  it('super admin created on boot reaches platform routes; org users do not', async () => {
    const agent = request.agent(getApp());
    const login = await agent.post('/api/v1/auth/login').send({ email: 'root@solarflow.test', password: 'RootPass123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.isSuperAdmin).toBe(true);
    expect(login.body.data.org).toBeNull();
    const stats = await agent.get('/api/v1/platform/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data).toHaveProperty('orgs');

    const org = await registerOrg();
    expect((await org.owner.get('/api/v1/platform/stats')).status).toBe(403);
    // super admin has no tenant context
    expect((await agent.get('/api/v1/projects')).status).toBe(403);
  });

  it('cannot demote or deactivate the last owner', async () => {
    const org = await registerOrg();
    await addUser(org, 'admin');
    const res = await org.owner.patch(`/api/v1/users/${org.ownerId}`).send({ roleKey: 'admin' });
    expect(res.status).toBe(409);
    const del = await org.owner.delete(`/api/v1/users/${org.ownerId}`);
    expect(del.status).toBe(409);
  });
});
