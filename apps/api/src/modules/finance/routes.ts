import { Router } from 'express';
import { ctxOf } from '../../lib/context';
import { ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { parseRange } from '../payments/service';
import { financeDashboard } from './service';

export const financeRouter = Router();
financeRouter.get('/dashboard', requirePermission('finance:read'), requireFeature('finance_dashboard'), async (req, res) =>
  ok(res, await financeDashboard(ctxOf(req), parseRange(req.query))),
);
