import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessClaims {
  sub: string;
  sid: string;
  org: string | null;
}
export interface RefreshClaims {
  sub: string;
  sid: string;
  jti: string;
}

const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** Parse `15m`, `7d`, `3600` (seconds) into milliseconds. */
export function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhdw])?$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration "${value}"`);
  return Number(m[1]) * (m[2] ? UNITS[m[2]]! : 1000);
}

export const accessTtlMs = () => durationMs(env.ACCESS_TOKEN_TTL);
export const refreshTtlMs = () => durationMs(env.REFRESH_TOKEN_TTL);

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: Math.floor(accessTtlMs() / 1000), algorithm: 'HS256' });
}

export function signRefreshToken(claims: Omit<RefreshClaims, 'jti'>): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...claims, jti }, env.JWT_REFRESH_SECRET, { expiresIn: Math.floor(refreshTtlMs() / 1000), algorithm: 'HS256' });
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessClaims;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshClaims | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as RefreshClaims;
  } catch {
    return null;
  }
}

/** SHA-256 hex digest — used to store refresh/invite/reset tokens at rest. */
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
