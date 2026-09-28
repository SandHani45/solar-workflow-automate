import { Router } from 'express';
import { z } from 'zod';
import { leadActivitySchema, leadSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

const convertSchema = z.object({
  systemSizeKw: z.coerce.number().min(0).max(10000),
  contractValue: z.coerce.number().min(0).max(1e10).optional(),
});

export const leadsRouter = Router();
leadsRouter.use(requireFeature('leads_crm'));

leadsRouter.get('/board', requirePermission('leads:read'), async (req, res) => ok(res, await svc.leadBoard(ctxOf(req))));
leadsRouter.get('/', requirePermission('leads:read'), async (req, res) => {
  const { rows, meta } = await svc.listLeads(ctxOf(req), req.query);
  list(res, rows, meta);
});
leadsRouter.post('/', requirePermission('leads:write'), validateBody(leadSchema), async (req, res) => created(res, await svc.createLead(ctxOf(req), req.body)));
leadsRouter.get('/:id', requirePermission('leads:read'), async (req, res) => ok(res, await svc.getLead(ctxOf(req), req.params.id as string)));
leadsRouter.patch('/:id', requirePermission('leads:write'), validateBody(leadSchema.partial(), { patch: true }), async (req, res) =>
  ok(res, await svc.updateLead(ctxOf(req), req.params.id as string, req.body)),
);
leadsRouter.delete('/:id', requirePermission('leads:delete'), async (req, res) => ok(res, await svc.deleteLead(ctxOf(req), req.params.id as string)));
leadsRouter.post('/:id/activities', requirePermission('leads:write'), validateBody(leadActivitySchema), async (req, res) =>
  created(res, await svc.addActivity(ctxOf(req), req.params.id as string, req.body)),
);
leadsRouter.post('/:id/convert', requirePermission('projects:write'), validateBody(convertSchema), async (req, res) =>
  created(res, await svc.convertLead(ctxOf(req), req.params.id as string, req.body)),
);
