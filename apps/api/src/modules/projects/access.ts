import { can, isOid, type Ctx } from '../../lib/context';
import { notFound } from '../../lib/errors';
import { Types, type Filter, type ObjectId } from '../../lib/mongoose';
import { Project, type ProjectDoc } from './model';

/**
 * Row-level scoping for projects. Users with `projects:read_all` see every project of the
 * org; everyone else only projects where they are on the team, assigned a stage, or (for
 * customers) linked as the project's customer.
 */
export function projectScope(ctx: Ctx): Filter {
  const base: Filter = { orgId: ctx.orgOid, deletedAt: null };
  if (can(ctx, 'projects:read_all')) return base;
  const me = ctx.userOid;
  return {
    ...base,
    $or: [
      { 'team.sales': me },
      { 'team.manager': me },
      { 'team.engineer': me },
      { 'team.operations': me },
      { 'stages.assignee': me },
      { customerUserId: me },
    ],
  };
}

/** `null` = unrestricted (read_all); otherwise the ids the caller may see. */
export async function visibleProjectIds(ctx: Ctx): Promise<ObjectId[] | null> {
  if (can(ctx, 'projects:read_all')) return null;
  const rows = await Project.find(projectScope(ctx)).select('_id').lean();
  return rows.map((r) => r._id);
}

/** Filter fragment restricting a `projectId` field to visible projects. */
export async function projectIdFilter(ctx: Ctx, field = 'projectId'): Promise<Record<string, unknown>> {
  const ids = await visibleProjectIds(ctx);
  return ids ? { [field]: { $in: ids } } : {};
}

/**
 * Filter fragment for list endpoints that accept `?projectId=`: combines the optional
 * requested project with row-level visibility.
 */
export async function scopedProjectFilter(ctx: Ctx, requested: unknown, field = 'projectId'): Promise<Record<string, unknown>> {
  const ids = await visibleProjectIds(ctx);
  if (isOid(requested)) {
    const allowed = !ids || ids.some((i) => String(i) === requested);
    return { [field]: allowed ? new Types.ObjectId(requested) : { $in: [] } };
  }
  return ids ? { [field]: { $in: ids } } : {};
}

export async function findVisibleProject(ctx: Ctx, id: string): Promise<ProjectDoc> {
  if (!isOid(id)) throw notFound('Project');
  const p = await Project.findOne({ ...projectScope(ctx), _id: id }).lean();
  if (!p) throw notFound('Project');
  return p;
}

/** Ensure a referenced project exists in the org and is visible to the caller. */
export async function assertProjectAccess(ctx: Ctx, id: string | ObjectId): Promise<ProjectDoc> {
  return findVisibleProject(ctx, String(id));
}
