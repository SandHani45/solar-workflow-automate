import { Router } from 'express';
import { paymentSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const paymentsRouter = Router();
paymentsRouter.get('/', requirePermission('payments:read'), async (req, res) => {
  const { rows, meta } = await svc.listPayments(ctxOf(req), req.query);
  list(res, rows, meta);
});
paymentsRouter.post('/', requirePermission('payments:write'), validateBody(paymentSchema), async (req, res) => created(res, await svc.createPayment(ctxOf(req), req.body)));
paymentsRouter.delete('/:id', requirePermission('payments:write'), async (req, res) => ok(res, await svc.deletePayment(ctxOf(req), String(req.params.id))));
