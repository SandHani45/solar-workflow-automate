import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, type RegisterOrgInput } from '@solar/shared';
import { env } from '../../config/env';
import { oid } from '../../lib/context';
import { AppError, conflict, flatDetails, forbidden, notFound, unauthenticated } from '../../lib/errors';
import { refreshTtlMs, randomToken, sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { audit } from '../audit/service';
import { Org } from '../org/model';
import { createOrganisation } from '../org/service';
import { resolveOrgFeatures } from '../platform/catalogue';
import { Role } from '../roles/model';
import { User, type UserDoc, type UserSession } from '../users/model';

const MAX_SESSIONS = 10;
/** Parallel refresh calls from several tabs may present the previous token briefly. */
const REFRESH_GRACE_MS = 30_000;
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

let dummyHash: string | undefined;

export const hashPassword =(pw: string) => bcrypt.hash(pw, env.bcryptRounds);
export const verifyPassword = (pw: string, hash: string | undefined) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

/** Build the `Session` payload returned by /auth endpoints. */
export async function buildSession(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthenticated();
  const userOut = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleKey: user.roleKey,
    isSuperAdmin: user.isSuperAdmin,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
  };
  if (!user.orgId) {
    const features = await resolveOrgFeatures({}, undefined);
    return {
      user: userOut,
      org: null,
      role: null,
      permissions: [] as string[],
      features: Object.fromEntries(Object.keys(features).map((k) => [k, false])),
    };
  }
  const [org, role] = await Promise.all([Org.findById(user.orgId).lean(), Role.findOne({ orgId: user.orgId, key: user.roleKey }).lean()]);
  if (!org) throw unauthenticated();
  const permissions = user.roleKey === 'owner' ? [...ALL_PERMISSIONS] : (role?.permissions ?? []);
  return {
    user: userOut,
    org: { id: String(org._id), name: org.name, slug: org.slug, plan: org.plan, logoUrl: org.settings?.logoUrl, settings: org.settings },
    role: role ? { key: role.key, name: role.name, permissions } : null,
    permissions,
    features: await resolveOrgFeatures(org.features, user.roleKey),
  };
}

/** Start a new session: new sid + refresh token stored hashed on the user. */
export async function issueTokens(user: Pick<UserDoc, '_id' | 'orgId'>, client: ClientInfo = {}): Promise<IssuedTokens> {
  const sid = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: String(user._id), sid });
  const now = Date.now();
  const session: UserSession = {
    sid,
    tokenHash: sha256(refreshToken),
    createdAt: new Date(now),
    expiresAt: new Date(now + refreshTtlMs()),
    userAgent: client.userAgent?.slice(0, 200),
    ip: client.ip,
  };
  // Drop expired sessions, keep the newest MAX_SESSIONS - 1, then add this one.
  const fresh = await User.findById(user._id).select('sessions').lean();
  const keep = (fresh?.sessions ?? [])
    .filter((s) => s.expiresAt.getTime() > now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_SESSIONS - 1);
  await User.updateOne({ _id: user._id }, { $set: { sessions: [...keep, session] } });
  const accessToken = signAccessToken({ sub: String(user._id), sid, org: user.orgId ? String(user.orgId) : null });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterOrgInput, client: ClientInfo) {
  if (await User.exists({ email: input.email })) throw conflict('An account with this email already exists');
  const org = await createOrganisation({ name: input.orgName });
  const user = await User.create({
    orgId: org._id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    roleKey: 'owner',
    lastLoginAt: new Date(),
  });
  await audit({ orgId: String(org._id), userId: String(user._id) }, { action: 'create', entity: 'org', entityId: org._id, summary: `Registered organisation ${org.name}` });
  const tokens = await issueTokens(user, client);
  return { tokens, session: await buildSession(String(user._id)) };
}

export async function login(email: string, password: string, client: ClientInfo) {
  const user = await User.findOne({ email }).lean();
  // Always run bcrypt to keep timing uniform for unknown emails.
  dummyHash ??= await bcrypt.hash('not-a-real-password', env.bcryptRounds);
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid || !user.passwordHash) throw unauthenticated('Invalid email or password');
  if (!user.isActive) throw unauthenticated('Your account is deactivated');
  if (user.orgId && !user.isSuperAdmin) {
    const org = await Org.findById(user.orgId).select('isActive').lean();
    if (!org) throw unauthenticated('Invalid email or password');
    if (!org.isActive) throw forbidden('Your organisation has been suspended. Contact support.');
  }
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  const tokens = await issueTokens(user, client);
  if (user.orgId) await audit({ orgId: String(user.orgId), userId: String(user._id) }, { action: 'login', entity: 'user', entityId: user._id, summary: `${user.name} signed in` });
  return { tokens, session: await buildSession(String(user._id)) };
}

/**
 * Rotate a refresh token. Presenting a token that is no longer current (outside the short
 * grace window) is treated as theft: every session of that user is revoked.
 */
export async function refresh(refreshToken: string | undefined) {
  if (!refreshToken) throw unauthenticated('No refresh token');
  const claims = verifyRefreshToken(refreshToken);
  if (!claims) throw unauthenticated('Refresh token expired');
  const user = await User.findById(claims.sub).lean();
  if (!user || !user.isActive || !user.passwordHash) throw unauthenticated('Session expired');
  const session = user.sessions.find((s) => s.sid === claims.sid);
  if (!session || session.expiresAt.getTime() < Date.now()) throw unauthenticated('Session expired');

  const presented = sha256(refreshToken);
  const inGrace = session.prevTokenHash === presented && session.rotatedAt && Date.now() - session.rotatedAt.getTime() < REFRESH_GRACE_MS;
  if (session.tokenHash !== presented && !inGrace) {
    await User.updateOne({ _id: user._id }, { $set: { sessions: [] } });
    logger.warn({ userId: String(user._id) }, 'Refresh token reuse detected — all sessions revoked');
    if (user.orgId)
      await audit({ orgId: String(user.orgId), userId: String(user._id) }, { action: 'security', entity: 'user', entityId: user._id, summary: 'Refresh token reuse detected; all sessions revoked' });
    throw unauthenticated('Session revoked');
  }

  const newRefresh = signRefreshToken({ sub: String(user._id), sid: session.sid });
  const res = await User.updateOne(
    { _id: user._id, sessions: { $elemMatch: { sid: session.sid, tokenHash: session.tokenHash } } },
    {
      $set: {
        'sessions.$.tokenHash': sha256(newRefresh),
        'sessions.$.prevTokenHash': session.tokenHash,
        'sessions.$.rotatedAt': new Date(),
      },
    },
  );
  if (res.modifiedCount !== 1) throw unauthenticated('Session expired');
  const accessToken = signAccessToken({ sub: String(user._id), sid: session.sid, org: user.orgId ? String(user.orgId) : null });
  return { tokens: { accessToken, refreshToken: newRefresh }, session: await buildSession(String(user._id)) };
}

export async function logout(userId: string | undefined, sid: string | undefined): Promise<void> {
  if (!userId || !sid) return;
  await User.updateOne({ _id: userId }, { $pull: { sessions: { sid } } });
}

/** Figure out whose session a (possibly expired) refresh token belongs to. */
export function sessionFromRefresh(token: string | undefined): { userId: string; sid: string } | null {
  if (!token) return null;
  const c = verifyRefreshToken(token);
  return c ? { userId: c.sub, sid: c.sid } : null;
}

export async function changePassword(userId: string, currentSid: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthenticated();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', flatDetails([], { currentPassword: ['Current password is incorrect'] }));
  }
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword), sessions: user.sessions.filter((s) => s.sid === currentSid) } },
  );
  if (user.orgId) await audit({ orgId: String(user.orgId), userId }, { action: 'update', entity: 'user', entityId: user._id, summary: 'Changed password' });
}

/** Creates a reset token (stored hashed). Returns the raw token, or null for unknown emails. */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await User.findOne({ email, isActive: true }).lean();
  if (!user || !user.passwordHash) return null;
  const token = randomToken();
  await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: sha256(token), resetExpiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  return token;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await User.findOne({ resetTokenHash: sha256(token), resetExpiresAt: { $gt: new Date() } }).lean();
  if (!user) throw notFound('Reset link is invalid or has expired. Reset token');
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(password), sessions: [] }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 } },
  );
  if (user.orgId) await audit({ orgId: String(user.orgId), userId: String(user._id) }, { action: 'update', entity: 'user', entityId: user._id, summary: 'Reset password' });
}

async function findInvite(token: string) {
  const user = await User.findOne({ inviteTokenHash: sha256(token), inviteExpiresAt: { $gt: new Date() } }).lean();
  if (!user || !user.orgId) throw notFound('Invite');
  return user;
}

export async function describeInvite(token: string) {
  const user = await findInvite(token);
  const [org, role] = await Promise.all([Org.findById(user.orgId).lean(), Role.findOne({ orgId: user.orgId, key: user.roleKey }).lean()]);
  if (!org) throw notFound('Invite');
  return { email: user.email, name: user.name, orgName: org.name, roleName: role?.name ?? user.roleKey };
}

export async function acceptInvite(token: string, name: string, password: string, client: ClientInfo) {
  const user = await findInvite(token);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { name, passwordHash: await hashPassword(password), isActive: true, invitePending: false, lastLoginAt: new Date() },
      $unset: { inviteTokenHash: 1, inviteExpiresAt: 1 },
    },
  );
  await audit({ orgId: String(user.orgId), userId: String(user._id) }, { action: 'update', entity: 'user', entityId: user._id, summary: `${name} accepted the invite` });
  const tokens = await issueTokens(user, client);
  return { tokens, session: await buildSession(String(user._id)) };
}

/** Create an invite token for a user (stored hashed) and return the invite URL. */
export async function createInvite(userId: string): Promise<string> {
  const token = randomToken();
  await User.updateOne({ _id: oid(userId) }, { $set: { inviteTokenHash: sha256(token), inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS), invitePending: true } });
  return `${env.APP_URL.replace(/\/$/, '')}/invite/${token}`;
}

/** Boot-time: create the platform super admin from env if none exists. */
export async function ensureSuperAdmin(): Promise<void> {
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) return;
  if (await User.exists({ isSuperAdmin: true })) return;
  const email = env.SUPER_ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    existing.isSuperAdmin = true;
    await existing.save();
    logger.info({ email }, 'Existing user promoted to super admin');
    return;
  }
  await User.create({ orgId: null, name: 'Platform Admin', email, passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD), roleKey: 'super_admin', isSuperAdmin: true });
  logger.info({ email }, 'Super admin created');
}
