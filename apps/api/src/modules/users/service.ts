import type { InviteUserInput } from '@solar/shared';
import type { z } from 'zod';
import type { updateUserSchema } from '@solar/shared';
import { env } from '../../config/env';
import { isOid, type Ctx } from '../../lib/context';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { audit, diff } from '../audit/service';
import { createInvite, hashPassword } from '../auth/service';
import { Role } from '../roles/model';
import { User, type UserDoc } from './model';

const PUBLIC_FIELDS = '-sessions -passwordHash -inviteTokenHash -resetTokenHash';

async function findUser(ctx: Ctx, id: string): Promise<UserDoc> {
  if (!isOid(id)) throw notFound('User');
  const u = await User.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!u) throw notFound('User');
  return u;
}

async function assertRole(ctx: Ctx, roleKey: string) {
  if (!(await Role.exists({ orgId: ctx.orgOid, key: roleKey }))) throw badRequest(`Unknown role "${roleKey}"`);
  if (roleKey === 'owner' && ctx.roleKey !== 'owner') throw forbidden('Only an owner can grant the owner role');
}

async function activeOwnerCount(ctx: Ctx) {
  return User.countDocuments({ orgId: ctx.orgOid, roleKey: 'owner', isActive: true, invitePending: false });
}

export async function listUsers(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams(query, ['name', 'email', 'createdAt', 'lastLoginAt', 'roleKey'], 'name');
  const filter: Filter = { orgId: ctx.orgOid };
  if (typeof query.roleKey === 'string' && query.roleKey) filter.roleKey = { $in: query.roleKey.split(',') };
  if (query.isActive === 'true' || query.isActive === 'false') filter.isActive = query.isActive === 'true';
  if (p.q) filter.$or = [{ name: searchRegex(p.q) }, { email: searchRegex(p.q) }, { phone: searchRegex(p.q) }];
  const [rows, total] = await Promise.all([User.find(filter).select(PUBLIC_FIELDS).sort(p.sort).skip(p.skip).limit(p.limit).lean(), User.countDocuments(filter)]);
  return { rows, meta: pageMeta(p.page, p.limit, total) };
}

export async function userOptions(ctx: Ctx, role: unknown) {
  const filter: Filter = { orgId: ctx.orgOid, isActive: true, invitePending: false };
  if (typeof role === 'string' && role) filter.roleKey = { $in: role.split(',') };
  const rows = await User.find(filter).select('name roleKey email').sort({ name: 1 }).limit(500).lean();
  return rows.map((u) => ({ id: String(u._id), name: u.name, roleKey: u.roleKey, email: u.email }));
}

export async function getUser(ctx: Ctx, id: string) {
  await findUser(ctx, id);
  return User.findById(id).select(PUBLIC_FIELDS).lean();
}

export async function inviteUser(ctx: Ctx, input: InviteUserInput) {
  await assertRole(ctx, input.roleKey);
  if (await User.exists({ email: input.email })) throw conflict('A user with this email already exists');
  const user = await User.create({
    orgId: ctx.orgOid,
    name: input.name,
    email: input.email,
    phone: input.phone,
    roleKey: input.roleKey,
    isActive: true,
    invitePending: !input.password,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    invitedBy: ctx.userOid,
  });
  const inviteUrl = input.password ? undefined : await createInvite(String(user._id));
  if (inviteUrl && !env.isProd) logger.info({ email: input.email, inviteUrl }, 'Invite link (dev only)');
  await audit(ctx, { action: 'create', entity: 'user', entityId: user._id, summary: `${input.password ? 'Added' : 'Invited'} ${input.name} <${input.email}> as ${input.roleKey}` });
  return { user: await User.findById(user._id).select(PUBLIC_FIELDS).lean(), inviteUrl };
}

export async function updateUser(ctx: Ctx, id: string, input: z.infer<typeof updateUserSchema>) {
  const before = await findUser(ctx, id);
  if (before.roleKey === 'owner' && ctx.roleKey !== 'owner') throw forbidden('Only an owner can change another owner');
  if (input.roleKey && input.roleKey !== before.roleKey) await assertRole(ctx, input.roleKey);
  const demoting = before.roleKey === 'owner' && ((input.roleKey && input.roleKey !== 'owner') || input.isActive === false);
  if (demoting && before.isActive && (await activeOwnerCount(ctx)) <= 1) throw conflict('Cannot demote or deactivate the last owner');
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
  if (input.isActive === false) set.sessions = [];
  await User.updateOne({ _id: before._id, orgId: ctx.orgOid }, { $set: set });
  await audit(ctx, { action: 'update', entity: 'user', entityId: before._id, summary: `Updated user ${before.name}`, changes: diff(before as any, input) });
  return getUser(ctx, id);
}

export async function deactivateUser(ctx: Ctx, id: string) {
  const before = await findUser(ctx, id);
  if (before.roleKey === 'owner' && ctx.roleKey !== 'owner') throw forbidden('Only an owner can deactivate another owner');
  if (before.roleKey === 'owner' && before.isActive && (await activeOwnerCount(ctx)) <= 1) throw conflict('Cannot deactivate the last owner');
  await User.updateOne({ _id: before._id, orgId: ctx.orgOid }, { $set: { isActive: false, sessions: [] } });
  await audit(ctx, { action: 'delete', entity: 'user', entityId: before._id, summary: `Deactivated user ${before.name}` });
  return { ok: true };
}
