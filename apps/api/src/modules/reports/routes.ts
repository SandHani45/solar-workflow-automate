import { Router } from 'express';
import { ctxOf } from '../../lib/context';
import { requireFeature, requirePermission } from '../../middleware/auth';
import { parseRange } from '../payments/service';
import { buildReport } from './service';

export const reportsRouter = Router();

reportsRouter.get('/:kind.csv', requirePermission('reports:export'), requireFeature('reports_export'), async (req, res) => {
  const kind = String(req.params.kind);
  const csv = await buildReport(ctxOf(req), kind, parseRange(req.query as Record<string, unknown>));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(csv);
});
