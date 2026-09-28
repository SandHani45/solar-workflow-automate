import type { Request } from 'express';
import type { FeatureKey, Permission } from '@solar/shared';
import { forbidden, unauthenticated } from './errors';
import { Types, type ObjectId } from './mongoose';

/** Everything a service needs to know about the caller. Built by `requireAuth`. */
export interface AuthContext {
  userId: string;
  userOid: ObjectId;
  orgId: string | null;
  orgOid: ObjectId | null;
  sid: string;
  name: string;
  email: string;
  roleKey: string;
  isSuperAdmin: boolean;
  permissions: string[];
  features: Record<FeatureKey, boolean>;
}

/** A context guaranteed to belong to an organisation (all tenant routes). */
export interface Ctx extends AuthContext {
  orgId: string;
  orgOid: ObjectId;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function authOf(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

export function ctxOf(req: Request): Ctx {
  const a = authOf(req);
  if (!a.orgId || !a.orgOid) throw forbidden('This action requires an organisation account');
  return a as Ctx;
}

export const can = (ctx: Pick<AuthContext, 'permissions'>, perm: Permission) => ctx.permissions.includes(perm);
export const hasFeature = (ctx: Pick<AuthContext, 'features'>, key: FeatureKey) => ctx.features[key] === true;

export const oid = (id: string | ObjectId) => (id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id)));
export const isOid = (id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
export const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);
