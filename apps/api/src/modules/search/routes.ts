import { Router } from 'express';
import { ctxOf } from '../../lib/context';
import { ok } from '../../lib/http';
import { globalSearch } from './service';

export const searchRouter = Router();

searchRouter.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
  ok(res, await globalSearch(ctxOf(req), q));
});
