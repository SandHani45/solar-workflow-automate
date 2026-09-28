import { Router } from 'express';
import { advanceSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const advancesRouter = Router();
advancesRouter.get('/', requirePermission('finance:read'), async (req, res) => {
  const { rows, meta } = await svc.listAdvances(ctxOf(req), req.query);
  list(res, rows, meta);
});
advancesRouter.post('/', requirePermission('finance:partners'), validateBody(advanceSchema), async (req, res) => created(res, await svc.createAdvance(ctxOf(req), req.body)));
advancesRouter.post('/:id/settle', requirePermission('finance:partners'), async (req, res) => ok(res, await svc.settleAdvance(ctxOf(req), String(req.params.id))));
