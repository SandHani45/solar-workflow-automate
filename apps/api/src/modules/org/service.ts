import {
  DEFAULT_ADVANCE_PERCENT,
  DEFAULT_ROLES,
  DEFAULT_STAGES,
  FEATURE_KEYS,
  PHASES,
  validateWorkflow,
  type FeatureKey,
  type OrgFeatureMap,
  type StageDefinition,
} from '@solar/shared';
import type { z } from 'zod';
import type { orgFeatureUpdateSchema, orgSettingsSchema, partnersSchema } from '@solar/shared';
import { can, oid, type Ctx } from '../../lib/context';
import { AppError, flatDetails, forbidden, notFound } from '../../lib/errors';
import { audit, diff } from '../audit/service';
import { orgFeatureRows, resolveOrgFeatures } from '../platform/catalogue';
import { syncOrgProjectsForFeatures } from '../projects/workflow.service';
import { Role } from '../roles/model';
import { Org, type OrgDoc } from './model';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await Org.exists({ slug }); i++) slug = `${base}-${i}`;
  return slug;
}

/**
 * Create a tenant with default roles and the default workflow (v1). Features start with no
 * overrides, i.e. they resolve to the platform catalogue defaults (and follow later changes
 * of those defaults until the org or the platform sets an explicit override).
 */
export async function createOrganisation(input: { name: string; plan?: OrgDoc['plan']; slug?: string; features?: OrgFeatureMap }): Promise<OrgDoc> {
  const features: OrgFeatureMap = input.features ?? {};
  const org = await Org.create({
    name: input.name,
    slug: input.slug ?? (await uniqueSlug(input.name)),
    plan: input.plan ?? 'starter',
    settings: { advancePercent: DEFAULT_ADVANCE_PERCENT, defaultGstPercent: 12 },
    features,
    partners: [],
    workflow: { version: 1, stages: structuredClone(DEFAULT_STAGES) },
  });
  await Role.insertMany(DEFAULT_ROLES.map((r) => ({ ...r, orgId: org._id, permissions: [...r.permissions] })));
  return org.toObject();
}

export async function getOrgOrThrow(orgId: string): Promise<OrgDoc> {
  const org = await Org.findById(orgId).lean();
  if (!org) throw notFound('Organisation');
  return org;
}

export async function getOrgSummary(ctx: Ctx) {
  const org = await getOrgOrThrow(ctx.orgId);
  const features = await resolveOrgFeatures(org.features, ctx.roleKey);
  const seePartners = can(ctx, 'finance:read') || can(ctx, 'finance:partners');
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    settings: org.settings,
    partners: seePartners ? org.partners : [],
    features,
  };
}

export async function updateSettings(ctx: Ctx, input: z.infer<typeof orgSettingsSchema>) {
  const org = await getOrgOrThrow(ctx.orgId);
  const { name, ...settings } = input;
  const $set: Record<string, unknown> = {};
  if (name) $set.name = name;
  for (const [k, v] of Object.entries(settings)) if (v !== undefined) $set[`settings.${k}`] = v;
  if (Object.keys($set).length) await Org.updateOne({ _id: org._id }, { $set });
  await audit(ctx, {
    action: 'update',
    entity: 'org',
    entityId: org._id,
    summary: 'Updated organisation settings',
    changes: diff({ name: org.name, ...org.settings }, input),
  });
  return getOrgSummary(ctx);
}

export async function listOrgFeatures(ctx: Ctx) {
  const org = await getOrgOrThrow(ctx.orgId);
  return orgFeatureRows(org.features);
}

export async function updateOrgFeature(ctx: Ctx, input: z.infer<typeof orgFeatureUpdateSchema>) {
  const org = await getOrgOrThrow(ctx.orgId);
  const current = org.features?.[input.key];
  if (current?.lockedByPlatform && input.enabled) {
    throw forbidden(`"${input.key}" is locked by the platform for your plan and cannot be enabled`);
  }
  const next = { ...(current ?? {}), enabled: input.enabled, roles: input.roles ?? current?.roles ?? [] };
  await Org.updateOne({ _id: org._id }, { $set: { [`features.${input.key}`]: next } });
  await audit(ctx, {
    action: 'update',
    entity: 'feature',
    entityId: org._id,
    summary: `${input.enabled ? 'Enabled' : 'Disabled'} feature ${input.key}${input.roles?.length ? ` for roles ${input.roles.join(', ')}` : ''}`,
    changes: { [input.key]: { from: current ?? null, to: next } },
  });
  await syncOrgProjectsForFeatures(ctx.orgId);
  return listOrgFeatures(ctx);
}

export async function getPartners(ctx: Ctx) {
  const org = await getOrgOrThrow(ctx.orgId);
  return { partners: org.partners };
}

export async function setPartners(ctx: Ctx, input: z.infer<typeof partnersSchema>) {
  const org = await getOrgOrThrow(ctx.orgId);
  const partners = input.partners.map((p) => ({ name: p.name, sharePercent: p.sharePercent, userId: p.userId ? oid(p.userId) : undefined }));
  await Org.updateOne({ _id: org._id }, { $set: { partners } });
  await audit(ctx, {
    action: 'update',
    entity: 'org',
    entityId: org._id,
    summary: `Updated partners: ${partners.map((p) => `${p.name} ${p.sharePercent}%`).join(', ') || 'none'}`,
  });
  return getPartners(ctx);
}

export async function getWorkflow(orgId: string) {
  const org = await getOrgOrThrow(orgId);
  return { version: org.workflow.version, phases: PHASES, stages: org.workflow.stages };
}

export async function replaceWorkflow(ctx: Ctx, stages: StageDefinition[], summary: string) {
  const errors = validateWorkflow(stages);
  if (errors.length) throw new AppError(400, 'VALIDATION_ERROR', errors[0]!, flatDetails(errors));
  const org = await Org.findOneAndUpdate(
    { _id: ctx.orgOid },
    { $set: { 'workflow.stages': stages }, $inc: { 'workflow.version': 1 } },
    { returnDocument: 'after' },
  ).lean();
  if (!org) throw notFound('Organisation');
  await audit(ctx, { action: 'update', entity: 'workflow', entityId: org._id, summary: `${summary} (v${org.workflow.version})` });
  return { version: org.workflow.version, phases: PHASES, stages: org.workflow.stages };
}

export const resetWorkflow = (ctx: Ctx) => replaceWorkflow(ctx, structuredClone(DEFAULT_STAGES), 'Reset workflow to defaults');

export const isFeatureKey = (k: string): k is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(k);
