import { Router } from 'express';
import { boqSchema, commentSchema, projectSchema, projectUpdateSchema, stageUpdateSchema } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { created, list, ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';
import { reopenStage, updateStage } from './workflow.service';

export const projectsRouter = Router();

const id = (req: { params: Record<string, unknown> }) => String(req.params.id);

projectsRouter.get('/board', requirePermission('projects:read'), async (req, res) => ok(res, await svc.projectBoard(ctxOf(req))));
projectsRouter.get('/', requirePermission('projects:read'), async (req, res) => {
  const { rows, meta } = await svc.listProjects(ctxOf(req), req.query);
  list(res, rows, meta);
});
projectsRouter.post('/', requirePermission('projects:write'), validateBody(projectSchema), async (req, res) => created(res, await svc.createProject(ctxOf(req), req.body)));
projectsRouter.get('/:id', requirePermission('projects:read'), async (req, res) => ok(res, await svc.getProjectDetail(ctxOf(req), id(req))));
projectsRouter.patch('/:id', requirePermission('projects:write'), validateBody(projectUpdateSchema, { patch: true }), async (req, res) =>
  ok(res, await svc.updateProject(ctxOf(req), id(req), req.body)),
);
projectsRouter.delete('/:id', requirePermission('projects:delete'), async (req, res) => ok(res, await svc.deleteProject(ctxOf(req), id(req))));

projectsRouter.patch('/:id/stages/:stageKey', requirePermission('workflow:advance'), validateBody(stageUpdateSchema), async (req, res) => {
  const ctx = ctxOf(req);
  await updateStage(ctx, id(req), String(req.params.stageKey), req.body);
  ok(res, await svc.getProjectDetail(ctx, id(req)));
});
projectsRouter.post('/:id/stages/:stageKey/reopen', requirePermission('workflow:override'), async (req, res) => {
  const ctx = ctxOf(req);
  await reopenStage(ctx, id(req), String(req.params.stageKey));
  ok(res, await svc.getProjectDetail(ctx, id(req)));
});

projectsRouter.put('/:id/boq', requirePermission('projects:write'), validateBody(boqSchema), async (req, res) => ok(res, await svc.setBoq(ctxOf(req), id(req), req.body)));
projectsRouter.get('/:id/comments', requirePermission('projects:read'), async (req, res) => ok(res, await svc.listComments(ctxOf(req), id(req))));
projectsRouter.post('/:id/comments', requirePermission('projects:read'), validateBody(commentSchema), async (req, res) =>
  created(res, await svc.addComment(ctxOf(req), id(req), req.body.body)),
);
projectsRouter.get('/:id/timeline', requirePermission('projects:read'), async (req, res) => ok(res, await svc.projectTimeline(ctxOf(req), id(req))));
projectsRouter.get('/:id/financials', requirePermission('payments:read'), async (req, res) => ok(res, await svc.projectFinancials(ctxOf(req), id(req))));
projectsRouter.post('/:id/customer-access', requirePermission('users:manage'), requireFeature('customer_portal'), async (req, res) =>
  created(res, await svc.grantCustomerAccess(ctxOf(req), id(req))),
);
