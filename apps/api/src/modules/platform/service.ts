import type { z } from 'zod';
import type { platformOrgUpdateSchema } from '@solar/shared';
import type { AuthContext } from '../../lib/context';
import { isOid } from '../../lib/context';
import { badRequest, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { audit } from '../audit/service';
import { Org } from '../org/model';
import { isFeatureKey } from '../org/service';
import { syncOrgProjectsForFeatures } from '../projects/workflow.service';
import { Project } from '../projects/model';
import { User } from '../users/model';
import { getCatalogue, invalidateCatalogue, orgFeatureRows } from './catalogue';
import { PlatformFeature } from './model';

export async function platformStats() {
  const [orgs, activeOrgs, users, projects] = await Promise.all([
    Org.countDocuments(),
    Org.countDocuments({ isActive: true }),
    User.countDocuments({ isSuperAdmin: false }),
    Project.countDocuments({ deletedAt: null }),
  ]);
  return { orgs, activeOrgs, users, projects };
}

async function countsByOrg(model: any, match: Filter) {
  const rows: { _id: unknown; n: number }[] = await model.aggregate([{ $match: match }, { $group: { _id: '$orgId', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listOrgs(query: Record<string, unknown>) {
  const p = pageParams(query, ['createdAt', 'name', 'plan']);
  const filter: Filter = {};
  if (p.q) filter.$or = [{ name: searchRegex(p.q) }, { slug: searchRegex(p.q) }];
  if (typeof query.plan === 'string' && query.plan) filter.plan = query.plan;
  if (query.isActive === 'true' || query.isActive === 'false') filter.isActive = query.isActive === 'true';
  const [orgs, total] = await Promise.all([Org.find(filter).select('-workflow').sort(p.sort).skip(p.skip).limit(p.limit).lean(), Org.countDocuments(filter)]);
  const ids = orgs.map((o) => o._id);
  const [users, projects, activeProjects] = await Promise.all([
    countsByOrg(User, { orgId: { $in: ids } }),
    countsByOrg(Project, { orgId: { $in: ids }, deletedAt: null }),
    countsByOrg(Project, { orgId: { $in: ids }, deletedAt: null, status: 'active' }),
  ]);
  const rows = orgs.map((o) => ({
    id: String(o._id),
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    isActive: o.isActive,
    createdAt: o.createdAt,
    counts: { users: users.get(String(o._id)) ?? 0, projects: projects.get(String(o._id)) ?? 0, activeProjects: activeProjects.get(String(o._id)) ?? 0 },
  }));
  return { rows, meta: pageMeta(p.page, p.limit, total) };
}

export async function getOrgDetail(id: string) {
  if (!isOid(id)) throw notFound('Organisation');
  const org = await Org.findById(id).lean();
  if (!org) throw notFound('Organisation');
  const [users, projects, owners] = await Promise.all([
    User.countDocuments({ orgId: org._id }),
    Project.countDocuments({ orgId: org._id, deletedAt: null }),
    User.find({ orgId: org._id, roleKey: 'owner' }).select('name email lastLoginAt').lean(),
  ]);
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    isActive: org.isActive,
    settings: org.settings,
    createdAt: org.createdAt,
    workflowVersion: org.workflow.version,
    counts: { users, projects },
    owners,
    features: await orgFeatureRows(org.features),
  };
}

export async function updateOrg(actor: AuthContext, id: string, input: z.infer<typeof platformOrgUpdateSchema>) {
  const detail = await getOrgDetail(id);
  const set: Record<string, unknown> = {};
  if (input.plan) set.plan = input.plan;
  if (input.isActive !== undefined) set.isActive = input.isActive;
  const org = await Org.findById(id).select('features').lean();
  for (const [key, override] of Object.entries(input.features ?? {})) {
    if (!isFeatureKey(key)) throw badRequest(`Unknown feature "${key}"`);
    const current = org?.features?.[key];
    set[`features.${key}`] = {
      enabled: override.enabled,
      roles: override.roles ?? current?.roles ?? [],
      lockedByPlatform: override.lockedByPlatform ?? current?.lockedByPlatform ?? false,
    };
  }
  if (Object.keys(set).length) await Org.updateOne({ _id: id }, { $set: set });
  await audit({ orgId: id, userId: actor.userId }, { action: 'platform.update', entity: 'org', entityId: id, summary: `Platform updated ${detail.name}: ${Object.keys(set).join(', ') || 'no changes'}` });
  if (input.features) await syncOrgProjectsForFeatures(id);
  return getOrgDetail(id);
}

export async function listFeatures() {
  return getCatalogue();
}

export async function updateFeature(actor: AuthContext, key: string, input: { name?: string; description?: string; defaultEnabled?: boolean }) {
  if (!isFeatureKey(key)) throw notFound('Feature');
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) set[k] = v;
  const doc = await PlatformFeature.findOneAndUpdate({ key }, { $set: set }, { returnDocument: 'after' }).lean();
  if (!doc) throw notFound('Feature');
  invalidateCatalogue();
  await audit({ orgId: null, userId: actor.userId }, { action: 'platform.update', entity: 'feature', summary: `Updated platform feature ${key}` });
  if (input.defaultEnabled !== undefined) {
    // Orgs without an explicit override follow the new default: re-apply stage skips.
    const orgs = await Org.find({ [`features.${key}`]: { $exists: false } }).select('_id').lean();
    for (const o of orgs) await syncOrgProjectsForFeatures(o._id);
  }
  return (await getCatalogue()).find((f) => f.key === key);
}
