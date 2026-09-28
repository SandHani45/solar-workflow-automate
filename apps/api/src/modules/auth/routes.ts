import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  acceptInviteSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerOrgSchema,
  resetPasswordSchema,
} from '@solar/shared';
import { env } from '../../config/env';
import { authOf } from '../../lib/context';
import { AppError } from '../../lib/errors';
import { ok } from '../../lib/http';
import { accessTtlMs, refreshTtlMs } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { ACCESS_COOKIE, REFRESH_COOKIE, requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as auth from './service';

const REFRESH_PATH = '/api/v1/auth';

function setAuthCookies(res: Response, tokens: auth.IssuedTokens): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: env.isProd };
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, path: '/', maxAge: accessTtlMs() });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, path: REFRESH_PATH, maxAge: refreshTtlMs() });
}

function clearAuthCookies(res: Response): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: env.isProd };
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}

const client = (req: Request): auth.ClientInfo => ({ userAgent: req.get('user-agent'), ip: req.ip });

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again in a few minutes.')),
  });

/** Credential endpoints: strict. Refresh: generous (called by every tab on 401). */
const strict = limiter(20);
const relaxed = limiter(300);

export const authRouter = Router();

authRouter.post('/register', strict, validateBody(registerOrgSchema), async (req, res) => {
  const { tokens, session } = await auth.register(req.body, client(req));
  setAuthCookies(res, tokens);
  ok(res, session, 201);
});

authRouter.post('/login', strict, validateBody(loginSchema), async (req, res) => {
  const { tokens, session } = await auth.login(req.body.email, req.body.password, client(req));
  setAuthCookies(res, tokens);
  ok(res, session);
});

authRouter.post('/refresh', relaxed, async (req, res) => {
  try {
    const { tokens, session } = await auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    setAuthCookies(res, tokens);
    ok(res, session);
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  const s = auth.sessionFromRefresh(req.cookies?.[REFRESH_COOKIE]);
  await auth.logout(s?.userId, s?.sid);
  clearAuthCookies(res);
  ok(res, { ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  ok(res, await auth.buildSession(authOf(req).userId));
});

authRouter.post('/change-password', strict, requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  const a = authOf(req);
  await auth.changePassword(a.userId, a.sid, req.body.currentPassword, req.body.newPassword);
  ok(res, { ok: true });
});

authRouter.post('/forgot-password', strict, validateBody(forgotPasswordSchema), async (req, res) => {
  const token = await auth.createPasswordResetToken(req.body.email);
  if (token && !env.isProd) {
    logger.info({ email: req.body.email, resetUrl: `${env.APP_URL}/reset-password?token=${token}` }, 'Password reset link (dev only)');
  }
  // Email delivery is out of scope; the response never reveals whether the email exists.
  ok(res, { ok: true });
});

authRouter.post('/reset-password', strict, validateBody(resetPasswordSchema), async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  ok(res, { ok: true });
});

authRouter.get('/invite/:token', relaxed, async (req, res) => {
  ok(res, await auth.describeInvite(String(req.params.token)));
});

authRouter.post('/accept-invite', strict, validateBody(acceptInviteSchema), async (req, res) => {
  const { tokens, session } = await auth.acceptInvite(req.body.token, req.body.name, req.body.password, client(req));
  setAuthCookies(res, tokens);
  ok(res, session);
});
