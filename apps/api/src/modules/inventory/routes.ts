import { Router } from 'express';
import { z } from 'zod';
import { itemSchema, stockMovementSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

/** `direction` is a local extension for `adjust` (shared schema has positive quantities only). */
const movementSchema = stockMovementSchema.extend({ direction: z.enum(['increase', 'decrease']).optional() });

export const inventoryRouter = Router();
inventoryRouter.use(requireFeature('inventory'));

inventoryRouter.get('/items', requirePermission('inventory:read'), async (req, res) => {
  const { rows, meta } = await svc.listItems(ctxOf(req), req.query);
  list(res, rows, meta);
});
inventoryRouter.post('/items', requirePermission('inventory:write'), validateBody(itemSchema), async (req, res) => created(res, await svc.createItem(ctxOf(req), req.body)));
inventoryRouter.get('/items/:id', requirePermission('inventory:read'), async (req, res) => {
  const ctx = ctxOf(req);
  ok(res, svc.withStock(await svc.getItem(ctx, String(req.params.id)), await svc.computeReserved(ctx.orgOid)));
});
inventoryRouter.patch('/items/:id', requirePermission('inventory:write'), validateBody(itemSchema.partial(), { patch: true }), async (req, res) =>
  ok(res, await svc.updateItem(ctxOf(req), String(req.params.id), req.body)),
);
inventoryRouter.delete('/items/:id', requirePermission('inventory:write'), async (req, res) => ok(res, await svc.archiveItem(ctxOf(req), String(req.params.id))));

inventoryRouter.get('/movements', requirePermission('inventory:read'), async (req, res) => {
  const { rows, meta } = await svc.listMovements(ctxOf(req), req.query);
  list(res, rows, meta);
});
inventoryRouter.post('/movements', validateBody(movementSchema), async (req, res) => {
  const ctx = ctxOf(req);
  svc.assertMovementPermission(ctx, req.body.type);
  created(res, await svc.applyMovement(ctx, req.body));
});
inventoryRouter.get('/summary', requirePermission('inventory:read'), async (req, res) => ok(res, await svc.inventorySummary(ctxOf(req))));
