import { Router } from 'express';
import { ctxOf } from '../../lib/context';
import { ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { dashboard } from './service';

export const dashboardRouter = Router();

dashboardRouter.get('/', requirePermission('dashboard:read'), async (req, res) => ok(res, await dashboard(ctxOf(req))));
