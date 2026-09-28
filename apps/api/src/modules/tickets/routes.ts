import { Router } from 'express';
import { commentSchema, ticketSchema, ticketUpdateSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const ticketsRouter = Router();
ticketsRouter.use(requireFeature('service_tickets'));

ticketsRouter.get('/', requirePermission('tickets:read'), async (req, res) => {
  const { rows, meta } = await svc.listTickets(ctxOf(req), req.query);
  list(res, rows, meta);
});
ticketsRouter.post('/', requirePermission('tickets:write'), validateBody(ticketSchema), async (req, res) => created(res, await svc.createTicket(ctxOf(req), req.body)));
ticketsRouter.get('/:id', requirePermission('tickets:read'), async (req, res) => ok(res, await svc.getTicket(ctxOf(req), String(req.params.id))));
ticketsRouter.patch('/:id', requirePermission('tickets:write'), validateBody(ticketUpdateSchema), async (req, res) =>
  ok(res, await svc.updateTicket(ctxOf(req), String(req.params.id), req.body)),
);
ticketsRouter.post('/:id/comments', requirePermission('tickets:write'), validateBody(commentSchema), async (req, res) =>
  created(res, await svc.addTicketComment(ctxOf(req), String(req.params.id), req.body.body)),
);
