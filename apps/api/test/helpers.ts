import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';

export type Agent = ReturnType<typeof request.agent>;

let app: Express | undefined;
export const getApp = () => (app ??= createApp());
export const api = () => request(getApp());

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
export const PASSWORD = 'Passw0rd!x';

export interface TestOrg {
  owner: Agent;
  orgId: string;
  ownerId: string;
  slug: string;
  users: Record<string, { agent: Agent; id: string; email: string }>;
}

/** Register a new org and log the owner in (cookie agent). */
export async function registerOrg(orgName = `Org ${uniq()}`): Promise<TestOrg> {
  const owner = request.agent(getApp());
  const email = `owner-${uniq()}@test.dev`;
  const res = await owner.post('/api/v1/auth/register').send({ orgName, name: 'Olivia Owner', email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { owner, orgId: res.body.data.org.id, ownerId: res.body.data.user.id, slug: res.body.data.org.slug, users: {} };
}

/** Create an active user with a role (via POST /users with password) and log them in. */
export async function addUser(org: TestOrg, roleKey: string, name = `${roleKey} user`) {
  const email = `${roleKey}-${uniq()}@test.dev`;
  const res = await org.owner.post('/api/v1/users').send({ name, email, roleKey, password: PASSWORD });
  if (res.status !== 201) throw new Error(`add user failed: ${res.status} ${JSON.stringify(res.body)}`);
  const agent = request.agent(getApp());
  const login = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  const u = { agent, id: res.body.data.user.id as string, email };
  org.users[roleKey] = u;
  return u;
}

export async function orgWithTeam(roles: string[] = ['manager', 'sales', 'operations', 'warehouse', 'engineer', 'accounts', 'service']) {
  const org = await registerOrg();
  for (const r of roles) await addUser(org, r);
  return org;
}

export const customerPayload = (over: Record<string, unknown> = {}) => ({
  customer: { name: 'Ramesh Patel', phone: '+91 98765 43210', email: `cust-${uniq()}@test.dev`, address: { city: 'Ahmedabad', state: 'Gujarat' } },
  systemSizeKw: 5,
  ...over,
});

export async function createProject(agent: Agent, over: Record<string, unknown> = {}) {
  const res = await agent.post('/api/v1/projects').send(customerPayload(over));
  if (res.status !== 201) throw new Error(`create project failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Smallest valid PNG. */
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a30000000049454e44ae426082', 'hex');
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

export async function uploadDoc(agent: Agent, projectId: string, type: string, stageKey?: string) {
  const req = agent.post('/api/v1/documents').field('projectId', projectId).field('type', type);
  if (stageKey) req.field('stageKey', stageKey);
  const res = await req.attach('file', PNG, { filename: `${type}.png`, contentType: 'image/png' });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export const stage = (project: any, key: string) => project.stages.find((s: any) => s.key === key);

/** Checklist with every item ticked, for a stage of a project payload. */
export const allDone = (project: any, key: string) => stage(project, key).checklist.map((c: any) => ({ label: c.label, done: true }));

export async function completeStage(agent: Agent, project: any, key: string, data: Record<string, unknown> = {}) {
  const res = await agent.patch(`/api/v1/projects/${project.id}/stages/${key}`).send({ status: 'completed', checklist: allDone(project, key), data });
  if (res.status !== 200) throw new Error(`complete ${key} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}
