import { Router } from 'express';
import { z } from 'zod';
import { platformOrgUpdateSchema } from '@solar/shared';
import { authOf } from '../../lib/context';
import { list, ok } from '../../lib/http';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

const featurePatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  defaultEnabled: z.boolean().optional(),
});

/** Mounted behind requireAuth + requireSuperAdmin. */
export const platformRouter = Router();

platformRouter.get('/stats', async (_req, res) => ok(res, await svc.platformStats()));
platformRouter.get('/orgs', async (req, res) => {
  const { rows, meta } = await svc.listOrgs(req.query);
  list(res, rows, meta);
});
platformRouter.get('/orgs/:id', async (req, res) => ok(res, await svc.getOrgDetail(String(req.params.id))));
platformRouter.patch('/orgs/:id', validateBody(platformOrgUpdateSchema), async (req, res) => ok(res, await svc.updateOrg(authOf(req), String(req.params.id), req.body)));
platformRouter.get('/features', async (_req, res) => ok(res, await svc.listFeatures()));
platformRouter.patch('/features/:key', validateBody(featurePatchSchema), async (req, res) => ok(res, await svc.updateFeature(authOf(req), String(req.params.key), req.body)));
