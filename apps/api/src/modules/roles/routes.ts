import { Router } from 'express';
import { PERMISSION_GROUPS, PERMISSION_LABELS, roleSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

export const rolesRouter = Router();

rolesRouter.get('/', async (req, res) => ok(res, await svc.listRoles(ctxOf(req))));
rolesRouter.post('/', requirePermission('roles:manage'), validateBody(roleSchema), async (req, res) => created(res, await svc.createRole(ctxOf(req), req.body)));
rolesRouter.patch('/:id', requirePermission('roles:manage'), validateBody(roleSchema.partial(), { patch: true }), async (req, res) =>
  ok(res, await svc.updateRole(ctxOf(req), req.params.id as string, req.body)),
);
rolesRouter.delete('/:id', requirePermission('roles:manage'), async (req, res) => ok(res, await svc.deleteRole(ctxOf(req), req.params.id as string)));

export const permissionsRouter = Router();
permissionsRouter.get('/', (_req, res) => ok(res, { groups: PERMISSION_GROUPS, labels: PERMISSION_LABELS }));
