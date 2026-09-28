import type { NextFunction, Request, Response } from 'express';
import { ALL_PERMISSIONS, FEATURE_KEYS, type FeatureKey, type Permission } from '@solar/shared';
import type { AuthContext } from '../lib/context';
import { featureDisabled, forbidden, unauthenticated } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import { isOid } from '../lib/context';
import { Org } from '../modules/org/model';
import { resolveOrgFeatures } from '../modules/platform/catalogue';
import { Role } from '../modules/roles/model';
import { User, type UserDoc } from '../modules/users/model';

export const ACCESS_COOKIE = 'sf_access';
export const REFRESH_COOKIE = 'sf_refresh';

function readAccessToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7).trim() || null;
  return null;
}

const NO_FEATURES = Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<FeatureKey, boolean>;

/** Load the effective auth context for a user id + session id. Returns null if invalid. */
export async function loadAuthContext(userId: string, sid: string): Promise<AuthContext | null> {
  if (!isOid(userId)) return null;
  const user = await User.findById(userId).select('+sessions').lean();
  if (!user || !user.isActive || !user.passwordHash) return null;
  const session = user.sessions.find((s) => s.sid === sid);
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return buildContext(user, sid);
}

/** Build a context for a user without a session (seed scripts, background jobs, tests). */
export async function contextForUserId(userId: string): Promise<AuthContext> {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthenticated('Unknown user');
  return buildContext(user, 'system');
}

async function buildContext(user: UserDoc, sid: string): Promise<AuthContext> {
  let permissions: string[] = [];
  let features = NO_FEATURES;
  if (user.orgId) {
    const [org, role] = await Promise.all([
      Org.findById(user.orgId).select('isActive features').lean(),
      Role.findOne({ orgId: user.orgId, key: user.roleKey }).select('permissions').lean(),
    ]);
    if (!org) throw unauthenticated('Organisation not found');
    if (!org.isActive && !user.isSuperAdmin) throw forbidden('Your organisation has been suspended. Contact support.');
    permissions = user.roleKey === 'owner' ? [...ALL_PERMISSIONS] : (role?.permissions ?? []);
    features = await resolveOrgFeatures(org.features, user.roleKey);
  }
  return {
    userId: String(user._id),
    userOid: user._id,
    orgId: user.orgId ? String(user.orgId) : null,
    orgOid: user.orgId ?? null,
    sid,
    name: user.name,
    email: user.email,
    roleKey: user.roleKey,
    isSuperAdmin: user.isSuperAdmin,
    permissions,
    features,
  };
}

/** Requires a valid access token (cookie `sf_access` or `Authorization: Bearer`). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readAccessToken(req);
  if (!token) throw unauthenticated();
  const claims = verifyAccessToken(token);
  if (!claims) throw unauthenticated('Session expired');
  const ctx = await loadAuthContext(claims.sub, claims.sid);
  if (!ctx) throw unauthenticated('Session expired');
  req.auth = ctx;
  next();
}

/** Tenant routes: caller must belong to an organisation. */
export function requireOrg(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.orgId) throw forbidden('This action requires an organisation account');
  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.isSuperAdmin) throw forbidden('Super admin only');
  next();
}

/** Caller must hold ALL listed permissions. */
export const requirePermission =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const granted = req.auth?.permissions ?? [];
    const missing = perms.filter((p) => !granted.includes(p));
    if (missing.length) throw forbidden(`Missing permission: ${missing.join(', ')}`);
    next();
  };

/** Caller must hold at least ONE of the listed permissions. */
export const requireAnyPermission =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const granted = req.auth?.permissions ?? [];
    if (!perms.some((p) => granted.includes(p))) throw forbidden(`Missing permission: one of ${perms.join(', ')}`);
    next();
  };

/** Feature must be enabled for the org (and the caller's role). */
export const requireFeature =
  (...keys: FeatureKey[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    for (const k of keys) if (!req.auth?.features[k]) throw featureDisabled(k);
    next();
  };
