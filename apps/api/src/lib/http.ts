import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { serialize } from './serialize';
import type { PageMeta } from './pagination';

/** `{ data }` success envelope. */
export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data: serialize(data) });
}

export function created(res: Response, data: unknown): void {
  ok(res, data, 201);
}

/** `{ data: [...], meta }` list envelope. */
export function list(res: Response, data: unknown[], meta: PageMeta | Record<string, unknown>): void {
  res.status(200).json({ data: serialize(data), meta });
}

/**
 * Express 5 already forwards rejected promises to the error handler; this wrapper keeps
 * handler signatures explicit and works for sync throws as well.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
