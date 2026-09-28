import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError, flatDetails } from '../lib/errors';

/**
 * Validate & replace `req.body` with the parsed value.
 * `patch: true` keeps only the top-level keys the client actually sent — zod v4 applies
 * `.default()` values even inside `.partial()`, which must not overwrite stored data.
 */
export const validateBody =
  (schema: ZodType, opts: { patch?: boolean } = {}) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const raw = req.body ?? {};
    const parsed = schema.parse(raw) as Record<string, unknown>;
    req.body =
      opts.patch && parsed && typeof parsed === 'object' && raw && typeof raw === 'object'
        ? Object.fromEntries(Object.entries(parsed).filter(([k]) => Object.prototype.hasOwnProperty.call(raw, k)))
        : parsed;
    next();
  };

/** Validate `req.query`; Express 5 makes `req.query` a getter so we redefine it. */
export const validateQuery =
  (schema: ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.query ?? {});
    Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true, enumerable: true });
    next();
  };

/** Reject Mongo operator injection: keys starting with `$` or containing `.`. */
export function findUnsafeKey(value: unknown, path = ''): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = findUnsafeKey(value[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') return path ? `${path}.${k}` : k;
      const r = findUnsafeKey(v, path ? `${path}.${k}` : k);
      if (r) return r;
    }
  }
  return null;
}

export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  const bad = findUnsafeKey(req.body) ?? findUnsafeKey(req.query);
  if (bad) {
    const msg = `Illegal key "${bad}": keys may not start with "$" or contain "."`;
    throw new AppError(400, 'VALIDATION_ERROR', msg, flatDetails([msg]));
  }
  next();
}
