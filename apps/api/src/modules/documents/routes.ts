import { Router } from 'express';
import multer from 'multer';
import { documentMetaSchema } from '@solar/shared';
import { env } from '../../config/env';
import { ctxOf } from '../../lib/context';
import { AppError, flatDetails } from '../../lib/errors';
import { created, list, ok } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import { sanitize } from '../../middleware/validate';
import * as svc from './service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    if (svc.ALLOWED_MIME[file.mimetype]) return cb(null, true);
    const msg = `Unsupported file type ${file.mimetype}. Allowed: PDF, JPG, PNG, WEBP, HEIC`;
    cb(new AppError(400, 'VALIDATION_ERROR', msg, flatDetails([msg])));
  },
});

export const documentsRouter = Router();

documentsRouter.get('/', requirePermission('documents:read'), async (req, res) => {
  const { rows, meta } = await svc.listDocuments(ctxOf(req), req.query);
  list(res, rows, meta);
});

documentsRouter.post('/', requirePermission('documents:write'), upload.single('file'), sanitize, async (req, res) => {
  // Multipart sends empty strings for blank fields; treat them as absent.
  const fields = Object.fromEntries(Object.entries(req.body ?? {}).filter(([, v]) => v !== ''));
  const meta = documentMetaSchema.parse(fields);
  created(res, await svc.uploadDocument(ctxOf(req), req.file, meta));
});

documentsRouter.get('/:id/download', requirePermission('documents:read'), async (req, res) => {
  const { doc, stream } = await svc.openDocument(ctxOf(req), String(req.params.id));
  const inline = req.query.inline === '1' || req.query.inline === 'true';
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Length', String(doc.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${doc.originalName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

documentsRouter.delete('/:id', requirePermission('documents:delete'), async (req, res) => ok(res, await svc.deleteDocument(ctxOf(req), String(req.params.id))));
