import { Router } from 'express';
import { z } from 'zod';
import { quotationSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

const statusSchema = z.object({ status: z.enum(['sent', 'accepted', 'rejected']) });

export const quotationsRouter = Router();
quotationsRouter.use(requireFeature('quotations'));

quotationsRouter.get('/', requirePermission('quotations:read'), async (req, res) => {
  const { rows, meta } = await svc.listQuotations(ctxOf(req), req.query);
  list(res, rows, meta);
});
quotationsRouter.post('/', requirePermission('quotations:write'), validateBody(quotationSchema), async (req, res) => created(res, await svc.createQuotation(ctxOf(req), req.body)));
quotationsRouter.get('/:id', requirePermission('quotations:read'), async (req, res) => ok(res, await svc.getQuotation(ctxOf(req), String(req.params.id))));
quotationsRouter.patch('/:id', requirePermission('quotations:write'), validateBody(quotationSchema.partial(), { patch: true }), async (req, res) =>
  ok(res, await svc.updateQuotation(ctxOf(req), String(req.params.id), req.body)),
);
quotationsRouter.post('/:id/status', requirePermission('quotations:write'), validateBody(statusSchema), async (req, res) =>
  ok(res, await svc.setQuotationStatus(ctxOf(req), String(req.params.id), req.body.status)),
);
