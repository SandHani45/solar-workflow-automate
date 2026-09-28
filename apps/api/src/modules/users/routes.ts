import { Router } from 'express';
import { inviteUserSchema, updateUserSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const usersRouter = Router();

usersRouter.get('/options', async (req, res) => ok(res, await svc.userOptions(ctxOf(req), req.query.role)));
usersRouter.get('/', requirePermission('users:read'), async (req, res) => {
  const { rows, meta } = await svc.listUsers(ctxOf(req), req.query);
  list(res, rows, meta);
});
usersRouter.post('/', requirePermission('users:manage'), validateBody(inviteUserSchema), async (req, res) => created(res, await svc.inviteUser(ctxOf(req), req.body)));
usersRouter.get('/:id', requirePermission('users:read'), async (req, res) => ok(res, await svc.getUser(ctxOf(req), req.params.id as string)));
usersRouter.patch('/:id', requirePermission('users:manage'), validateBody(updateUserSchema), async (req, res) =>
  ok(res, await svc.updateUser(ctxOf(req), req.params.id as string, req.body)),
);
usersRouter.delete('/:id', requirePermission('users:manage'), async (req, res) => ok(res, await svc.deactivateUser(ctxOf(req), req.params.id as string)));
