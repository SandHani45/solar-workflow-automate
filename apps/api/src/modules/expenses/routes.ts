import { Router } from 'express';
import { expenseDecisionSchema, expenseSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const expensesRouter = Router();
expensesRouter.use(requireFeature('expenses'));
expensesRouter.get('/', requirePermission('expenses:read'), async (req, res) => {
  const { rows, meta } = await svc.listExpenses(ctxOf(req), req.query);
  list(res, rows, meta);
});
expensesRouter.post('/', requirePermission('expenses:write'), validateBody(expenseSchema), async (req, res) => created(res, await svc.createExpense(ctxOf(req), req.body)));
expensesRouter.post('/:id/decision', requirePermission('expenses:approve'), validateBody(expenseDecisionSchema), async (req, res) =>
  ok(res, await svc.decideExpense(ctxOf(req), String(req.params.id), req.body)),
);
expensesRouter.delete('/:id', requirePermission('expenses:write'), async (req, res) => ok(res, await svc.deleteExpense(ctxOf(req), String(req.params.id))));
