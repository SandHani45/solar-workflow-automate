import { Router } from 'express';
import { z } from 'zod';
import { DOCUMENT_TYPES, FEATURE_KEYS, orgFeatureUpdateSchema, orgSettingsSchema, partnersSchema, type StageDefinition } from '@solar/shared';
import { ctxOf } from '../../lib/context';
import { ok } from '../../lib/http';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as svc from './service';

/** Shared has no zod schema for StageDefinition; this mirrors the TS interface. */
const stageFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(['text', 'textarea', 'number', 'currency', 'date', 'select', 'boolean', 'user']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  roleFilter: z.array(z.string()).optional(),
  placeholder: z.string().max(120).optional(),
});

const stageDefinitionSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,50}$/, 'lowercase letters, digits, underscore'),
  step: z.coerce.number().int().min(0).max(999),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).default(''),
  phase: z.enum(['sales', 'documentation', 'logistics', 'installation', 'accounts', 'net_metering', 'closure']),
  dependsOn: z.array(z.string()).default([]),
  ownerRoles: z.array(z.string()).min(1),
  requiredDocuments: z.array(z.enum(DOCUMENT_TYPES)).default([]),
  checklist: z.array(z.string().trim().min(1).max(200)).default([]),
  fields: z.array(stageFieldSchema).default([]),
  feature: z.enum(FEATURE_KEYS).optional(),
  optional: z.boolean().optional(),
  slaDays: z.coerce.number().min(0).max(365).default(3),
  requiresFullPayment: z.boolean().optional(),
  requiresAdvancePayment: z.boolean().optional(),
  automations: z
    .array(
      z.enum([
        'lead_mark_won',
        'reserve_boq_stock',
        'set_subsidy_status',
        'create_dispatch',
        'assign_engineer',
        'set_installation_date',
        'set_net_metering_submitted',
        'set_net_metering_inspected',
        'set_net_metering_meter_installed',
        'request_review',
        'close_project',
      ]),
    )
    .optional(),
  enabled: z.boolean().optional(),
});
const workflowSchema = z.object({ stages: z.array(stageDefinitionSchema).min(1).max(100) });

export const orgRouter = Router();

orgRouter.get('/', async (req, res) => ok(res, await svc.getOrgSummary(ctxOf(req))));
orgRouter.patch('/', requirePermission('settings:manage'), validateBody(orgSettingsSchema), async (req, res) => ok(res, await svc.updateSettings(ctxOf(req), req.body)));

orgRouter.get('/features', requirePermission('features:manage'), async (req, res) => ok(res, await svc.listOrgFeatures(ctxOf(req))));
orgRouter.put('/features', requirePermission('features:manage'), validateBody(orgFeatureUpdateSchema), async (req, res) => ok(res, await svc.updateOrgFeature(ctxOf(req), req.body)));

orgRouter.get('/partners', requirePermission('finance:partners'), async (req, res) => ok(res, await svc.getPartners(ctxOf(req))));
orgRouter.put('/partners', requirePermission('finance:partners'), validateBody(partnersSchema), async (req, res) => ok(res, await svc.setPartners(ctxOf(req), req.body)));

orgRouter.get('/workflow', async (req, res) => ok(res, await svc.getWorkflow(ctxOf(req).orgId)));
orgRouter.put('/workflow', requirePermission('workflow:manage'), requireFeature('workflow_customisation'), validateBody(workflowSchema), async (req, res) =>
  ok(res, await svc.replaceWorkflow(ctxOf(req), req.body.stages as StageDefinition[], 'Updated workflow')),
);
orgRouter.post('/workflow/reset', requirePermission('workflow:manage'), async (req, res) => ok(res, await svc.resetWorkflow(ctxOf(req))));
