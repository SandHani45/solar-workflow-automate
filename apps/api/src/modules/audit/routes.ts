import { Router } from 'express';
import { ctxOf, isOid, oid } from '../../lib/context';
import { list } from '../../lib/http';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { parseRange } from '../payments/service';
import { rangeFilter } from '../finance/calc';
import { USER_REF } from '../users/model';
import { AuditLog } from './model';

export const auditRouter = Router();

auditRouter.get('/', requirePermission('audit:read'), requireFeature('audit_log'), async (req, res) => {
  const ctx = ctxOf(req);
  const p = pageParams(req.query, ['createdAt']);
  const q = req.query as Record<string, unknown>;
  const filter: Filter = { orgId: ctx.orgOid, ...rangeFilter('createdAt', parseRange(q)) };
  if (typeof q.entity === 'string' && q.entity) filter.entity = q.entity;
  if (typeof q.action === 'string' && q.action) filter.action = q.action;
  if (isOid(q.entityId)) filter.entityId = oid(q.entityId);
  if (isOid(q.userId)) filter.userId = oid(q.userId);
  if (isOid(q.projectId)) filter.projectId = oid(q.projectId);
  if (p.q) filter.summary = searchRegex(p.q);
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('userId', USER_REF).lean(),
    AuditLog.countDocuments(filter),
  ]);
  list(
    res,
    rows.map(({ userId, orgId: _o, ...r }: any) => ({ ...r, user: userId && userId._id ? userId : null })),
    pageMeta(p.page, p.limit, total),
  );
});
