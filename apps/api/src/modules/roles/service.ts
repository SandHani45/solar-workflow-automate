import { ALL_PERMISSIONS, type RoleInput } from '@solar/shared';
import { isOid, type Ctx } from '../../lib/context';
import { conflict, forbidden, notFound } from '../../lib/errors';
import { audit, diff } from '../audit/service';
import { User } from '../users/model';
import { Role, type RoleDoc } from './model';

async function findRole(ctx: Ctx, id: string): Promise<RoleDoc> {
  if (!isOid(id)) throw notFound('Role');
  const r = await Role.findOne({ _id: id, orgId: ctx.orgOid }).lean();
  if (!r) throw notFound('Role');
  return r;
}

export async function listRoles(ctx: Ctx) {
  const [roles, counts] = await Promise.all([
    Role.find({ orgId: ctx.orgOid }).sort({ isSystem: -1, createdAt: 1 }).lean(),
    User.aggregate<{ _id: string; n: number }>([{ $match: { orgId: ctx.orgOid, isActive: true } }, { $group: { _id: '$roleKey', n: { $sum: 1 } } }]),
  ]);
  const byKey = new Map(counts.map((c) => [c._id, c.n]));
  return roles.map((r) => ({
    id: String(r._id),
    key: r.key,
    name: r.name,
    description: r.description,
    permissions: r.key === 'owner' ? [...ALL_PERMISSIONS] : r.permissions,
    isSystem: r.isSystem,
    userCount: byKey.get(r.key) ?? 0,
  }));
}

export async function createRole(ctx: Ctx, input: RoleInput) {
  if (await Role.exists({ orgId: ctx.orgOid, key: input.key })) throw conflict(`Role "${input.key}" already exists`);
  const role = await Role.create({ ...input, orgId: ctx.orgOid, isSystem: false, permissions: [...new Set(input.permissions)] });
  await audit(ctx, { action: 'create', entity: 'role', entityId: role._id, summary: `Created role ${role.name} (${role.permissions.length} permissions)` });
  return (await listRoles(ctx)).find((r) => r.id === String(role._id));
}

export async function updateRole(ctx: Ctx, id: string, input: Partial<RoleInput>) {
  const role = await findRole(ctx, id);
  if (role.key === 'owner' && input.permissions) throw forbidden('Owner permissions cannot be changed');
  if (input.key && input.key !== role.key) {
    if (role.isSystem) throw forbidden('System role keys cannot be changed');
    if (await Role.exists({ orgId: ctx.orgOid, key: input.key })) throw conflict(`Role "${input.key}" already exists`);
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = k === 'permissions' ? [...new Set(v as string[])] : v;
  await Role.updateOne({ _id: role._id, orgId: ctx.orgOid }, { $set: set });
  if (input.key && input.key !== role.key) await User.updateMany({ orgId: ctx.orgOid, roleKey: role.key }, { $set: { roleKey: input.key } });
  await audit(ctx, { action: 'update', entity: 'role', entityId: role._id, summary: `Updated role ${role.name}`, changes: diff(role as any, input) });
  return (await listRoles(ctx)).find((r) => r.id === String(role._id));
}

export async function deleteRole(ctx: Ctx, id: string) {
  const role = await findRole(ctx, id);
  if (role.isSystem) throw conflict('System roles cannot be deleted');
  const users = await User.countDocuments({ orgId: ctx.orgOid, roleKey: role.key });
  if (users > 0) throw conflict(`Role is assigned to ${users} user(s); reassign them first`);
  await Role.deleteOne({ _id: role._id, orgId: ctx.orgOid });
  await audit(ctx, { action: 'delete', entity: 'role', entityId: role._id, summary: `Deleted role ${role.name}` });
  return { ok: true };
}
