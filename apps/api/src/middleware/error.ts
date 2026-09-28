import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError, z } from 'zod';
import { env } from '../config/env';
import { AppError, flatDetails } from '../lib/errors';
import { logger } from '../lib/logger';
import { mongoose } from '../lib/mongoose';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', z.flattenError(err));
  if (err instanceof MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.MAX_UPLOAD_MB} MB)` : err.message;
    return new AppError(400, 'VALIDATION_ERROR', msg, flatDetails([msg]));
  }
  if (err instanceof mongoose.Error.CastError) {
    if (err.path === '_id') return new AppError(404, 'NOT_FOUND', 'Resource not found');
    const msg = `Invalid value for ${err.path}`;
    return new AppError(400, 'VALIDATION_ERROR', msg, flatDetails([], { [err.path]: [msg] }));
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fieldErrors = Object.fromEntries(Object.entries(err.errors).map(([k, e]) => [k, [e.message]]));
    return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', flatDetails([], fieldErrors));
  }
  const e = err as { code?: number | string; type?: string; status?: number; keyValue?: unknown; message?: string };
  if (e?.code === 11000) return new AppError(409, 'CONFLICT', 'A record with the same unique value already exists', { keyValue: e.keyValue });
  if (e?.type === 'entity.parse.failed') return new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON body', flatDetails(['Malformed JSON body']));
  if (e?.type === 'entity.too.large') return new AppError(400, 'VALIDATION_ERROR', 'Request body too large', flatDetails(['Request body too large']));
  const internal = new AppError(500, 'INTERNAL', 'Something went wrong. Please try again.');
  return internal;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const appErr = toAppError(err);
  if (appErr.status >= 500) {
    const log = (req as Request & { log?: typeof logger }).log ?? logger;
    log.error({ err }, 'Unhandled error');
  }
  const body: { code: string; message: string; details?: unknown } = { code: appErr.code, message: appErr.message };
  if (appErr.details !== undefined) body.details = appErr.details;
  if (appErr.status >= 500 && !env.isProd && err instanceof Error) body.details = { stack: err.stack?.split('\n').slice(0, 8) };
  if (res.headersSent) return;
  res.status(appErr.status).json({ error: body });
}
