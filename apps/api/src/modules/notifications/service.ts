import { oid } from '../../lib/context';
import { logger } from '../../lib/logger';
import type { ObjectId } from '../../lib/mongoose';
import { Org } from '../org/model';
import { resolveOrgFeatures } from '../platform/catalogue';
import { Role } from '../roles/model';
import { User } from '../users/model';
import { Notification } from './model';

export interface NotifyInput {
  title: string;
  body?: string;
  link?: string;
}

/** Create in-app notifications (no-op when the `notifications` feature is off). */
export async function notifyUsers(orgId: string | ObjectId, userIds: (string | ObjectId)[], input: NotifyInput, excludeUserId?: string): Promise<number> {
  try {
    const unique = [...new Set(userIds.map(String))].filter((id) => id && id !== excludeUserId);
    if (!unique.length) return 0;
    const org = await Org.findById(orgId).select('features').lean();
    if (!org) return 0;
    const features = await resolveOrgFeatures(org.features);
    if (!features.notifications) return 0;
    await Notification.insertMany(
      unique.map((u) => ({ orgId: oid(String(orgId)), userId: oid(u), title: input.title, body: input.body ?? '', link: input.link })),
    );
    return unique.length;
  } catch (err) {
    logger.warn({ err }, 'notification write failed');
    return 0;
  }
}

/** Active user ids in an org that hold any of the given role keys. */
export async function userIdsByRoles(orgId: string | ObjectId, roleKeys: string[]): Promise<string[]> {
  if (!roleKeys.length) return [];
  const users = await User.find({ orgId, roleKey: { $in: roleKeys }, isActive: true, invitePending: false }).select('_id').lean();
  return users.map((u) => String(u._id));
}

/** Active user ids whose role grants a permission. */
export async function userIdsWithPermission(orgId: string | ObjectId, permission: string): Promise<string[]> {
  const roles = await Role.find({ orgId, permissions: permission }).select('key').lean();
  return userIdsByRoles(orgId, [...new Set(['owner', ...roles.map((r) => r.key)])]);
}
