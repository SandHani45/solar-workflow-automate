import { Router } from 'express';
import { dispatchSchema, dispatchStatusSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { findVisibleProject } from '../projects/access';
import * as svc from './service';

export const dispatchesRouter = Router();
dispatchesRouter.use(requireFeature('dispatch'));

dispatchesRouter.get('/', requirePermission('dispatch:read'), async (req, res) => {
  const { rows, meta } = await svc.listDispatches(ctxOf(req), req.query);
  list(res, rows, meta);
});
dispatchesRouter.post('/', requirePermission('dispatch:write'), validateBody(dispatchSchema), async (req, res) => {
  const ctx = ctxOf(req);
  await findVisibleProject(ctx, req.body.projectId);
  const d = await svc.createDispatch(ctx, req.body);
  created(res, await svc.getDispatch(ctx, String(d._id)));
});
dispatchesRouter.get('/:id', requirePermission('dispatch:read'), async (req, res) => ok(res, await svc.getDispatch(ctxOf(req), String(req.params.id))));
dispatchesRouter.post('/:id/status', requirePermission('dispatch:write'), validateBody(dispatchStatusSchema), async (req, res) =>
  ok(res, await svc.setDispatchStatus(ctxOf(req), String(req.params.id), req.body.status, req.body.note)),
);
