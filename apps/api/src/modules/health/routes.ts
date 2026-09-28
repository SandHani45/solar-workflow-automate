import { Router } from 'express';
import { dbState } from '../../lib/db';
import { APP_VERSION } from '../../lib/version';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const db = dbState();
  res.status(db === 'up' ? 200 : 503).json({ data: { status: db === 'up' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()), version: APP_VERSION } });
});
