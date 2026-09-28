import { Router } from 'express';
import { z } from 'zod';
import { amcSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

const visitSchema = z.object({ done: z.boolean(), note: z.string().max(500).optional() });

export const amcRouter = Router();
amcRouter.use(requireFeature('amc_contracts'));
amcRouter.get('/', requirePermission('tickets:read'), async (req, res) => {
  const { rows, meta } = await svc.listAmc(ctxOf(req), req.query);
  list(res, rows, meta);
});
amcRouter.post('/', requirePermission('tickets:write'), validateBody(amcSchema), async (req, res) => created(res, await svc.createAmc(ctxOf(req), req.body)));
amcRouter.patch('/:id/visits/:visitId', requirePermission('tickets:write'), validateBody(visitSchema), async (req, res) =>
  ok(res, await svc.updateVisit(ctxOf(req), String(req.params.id), String(req.params.visitId), req.body)),
);
