import { Router } from 'express';
import { ctxOf, isOid } from '../../lib/context';
import { notFound } from '../../lib/errors';
import { list, ok } from '../../lib/http';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams } from '../../lib/pagination';
import { Notification } from './model';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const ctx = ctxOf(req);
  const p = pageParams(req.query);
  const own: Filter = { orgId: ctx.orgOid, userId: ctx.userOid };
  const filter: Filter = req.query.unread === 'true' ? { ...own, readAt: null } : own;
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...own, readAt: null }),
  ]);
  list(
    res,
    rows.map(({ orgId: _o, userId: _u, ...n }) => n),
    { ...pageMeta(p.page, p.limit, total), unread },
  );
});

notificationsRouter.post('/read-all', async (req, res) => {
  const ctx = ctxOf(req);
  const r = await Notification.updateMany({ orgId: ctx.orgOid, userId: ctx.userOid, readAt: null }, { $set: { readAt: new Date() } });
  ok(res, { ok: true, updated: r.modifiedCount });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const ctx = ctxOf(req);
  if (!isOid(req.params.id)) throw notFound('Notification');
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, orgId: ctx.orgOid, userId: ctx.userOid },
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
    { returnDocument: 'after', updatePipeline: true } as any,
  ).lean();
  if (!n) throw notFound('Notification');
  const { orgId: _o, userId: _u, ...rest } = n;
  ok(res, rest);
});
