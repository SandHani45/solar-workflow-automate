import crypto from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { z } from 'zod';
import { DOCUMENT_TYPE_LABELS, type documentMetaSchema } from '@solar/shared';
import { can, isOid, oid, type Ctx } from '../../lib/context';
import { badRequest, notFound } from '../../lib/errors';
import type { Filter } from '../../lib/mongoose';
import { pageMeta, pageParams, searchRegex } from '../../lib/pagination';
import { storage } from '../../lib/storage';
import { audit } from '../audit/service';
import { Expense } from '../expenses/model';
import { Lead } from '../leads/model';
import { leadScope } from '../leads/service';
import { findVisibleProject, visibleProjectIds } from '../projects/access';
import { Ticket } from '../tickets/model';
import { USER_REF } from '../users/model';
import { DocumentModel, type DocumentDoc } from './model';

export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Light magic-byte check so a renamed executable can't pose as a PDF/image. */
export function sniffMatches(buf: Buffer, mime: string): boolean {
  const hex = buf.subarray(0, 12).toString('hex');
  switch (mime) {
    case 'application/pdf':
      return buf.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'image/jpeg':
    case 'image/jpg':
      return hex.startsWith('ffd8ff');
    case 'image/png':
      return hex.startsWith('89504e470d0a1a0a');
    case 'image/webp':
      return buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'image/heic':
    case 'image/heif':
      return buf.subarray(4, 8).toString('latin1') === 'ftyp';
    default:
      return false;
  }
}

/** Document visibility follows the project/lead it belongs to (or the uploader). */
async function documentScope(ctx: Ctx): Promise<Filter> {
  const base: Filter = { orgId: ctx.orgOid };
  const ids = await visibleProjectIds(ctx);
  if (!ids) return base;
  const leadIds = can(ctx, 'leads:read') ? (await Lead.find(leadScope(ctx)).select('_id').lean()).map((l) => l._id) : [];
  return { ...base, $or: [{ projectId: { $in: ids } }, { leadId: { $in: leadIds } }, { uploadedBy: ctx.userOid }] };
}

const withUrl = (d: any) => ({ ...d, url: `/api/v1/documents/${d._id}/download` });

export async function listDocuments(ctx: Ctx, query: Record<string, unknown>) {
  const p = pageParams({ limit: 100, ...query }, ['createdAt', 'type', 'originalName']);
  const filter: Filter = await documentScope(ctx);
  for (const k of ['projectId', 'leadId', 'ticketId', 'expenseId'] as const) if (isOid(query[k])) filter[k] = oid(query[k] as string);
  if (typeof query.type === 'string' && query.type) filter.type = query.type;
  if (typeof query.stageKey === 'string' && query.stageKey) filter.stageKey = query.stageKey;
  if (p.q) filter.originalName = searchRegex(p.q);
  const [rows, total] = await Promise.all([
    DocumentModel.find(filter).sort(p.sort).skip(p.skip).limit(p.limit).populate('uploadedBy', USER_REF).lean(),
    DocumentModel.countDocuments(filter),
  ]);
  return { rows: rows.map(withUrl), meta: pageMeta(p.page, p.limit, total) };
}

export async function uploadDocument(ctx: Ctx, file: UploadedFile | undefined, meta: z.infer<typeof documentMetaSchema>) {
  if (!file) throw badRequest('A file is required (multipart field "file")');
  const ext = ALLOWED_MIME[file.mimetype];
  if (!ext) throw badRequest(`Unsupported file type ${file.mimetype}. Allowed: PDF, JPG, PNG, WEBP, HEIC`);
  if (!sniffMatches(file.buffer, file.mimetype)) throw badRequest('File content does not match its type');
  if (!meta.projectId && !meta.leadId && !meta.ticketId && !meta.expenseId) throw badRequest('Attach the document to a projectId, leadId, ticketId or expenseId');
  if (meta.projectId) await findVisibleProject(ctx, meta.projectId);
  if (meta.leadId && !(await Lead.exists({ ...leadScope(ctx), _id: meta.leadId }))) throw notFound('Lead');
  if (meta.ticketId && !(await Ticket.exists({ _id: meta.ticketId, orgId: ctx.orgOid }))) throw notFound('Ticket');
  if (meta.expenseId && !(await Expense.exists({ _id: meta.expenseId, orgId: ctx.orgOid }))) throw notFound('Expense');

  const key = `${ctx.orgId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
  await storage().save(key, file.buffer, file.mimetype);
  const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]/g, '_').slice(0, 200) || `document${ext}`;
  const doc = await DocumentModel.create({
    orgId: ctx.orgOid,
    projectId: meta.projectId ? oid(meta.projectId) : null,
    leadId: meta.leadId ? oid(meta.leadId) : null,
    ticketId: meta.ticketId ? oid(meta.ticketId) : null,
    expenseId: meta.expenseId ? oid(meta.expenseId) : null,
    type: meta.type,
    stageKey: meta.stageKey ?? null,
    originalName: safeName,
    mimeType: file.mimetype,
    size: file.size,
    storageKey: key,
    uploadedBy: ctx.userOid,
    note: meta.note,
  });
  await audit(ctx, { action: 'upload', entity: 'document', entityId: doc._id, projectId: doc.projectId, summary: `Uploaded ${DOCUMENT_TYPE_LABELS[meta.type]}: ${safeName}` });
  const out = await DocumentModel.findById(doc._id).populate('uploadedBy', USER_REF).lean();
  return withUrl(out);
}

async function findDocument(ctx: Ctx, id: string): Promise<DocumentDoc> {
  if (!isOid(id)) throw notFound('Document');
  const d = await DocumentModel.findOne({ ...(await documentScope(ctx)), _id: id }).lean();
  if (!d) throw notFound('Document');
  return d;
}

export async function openDocument(ctx: Ctx, id: string): Promise<{ doc: DocumentDoc; stream: Readable }> {
  const doc = await findDocument(ctx, id);
  try {
    return { doc, stream: await storage().read(doc.storageKey) };
  } catch {
    throw notFound('File');
  }
}

export async function deleteDocument(ctx: Ctx, id: string) {
  const doc = await findDocument(ctx, id);
  await DocumentModel.deleteOne({ _id: doc._id, orgId: ctx.orgOid });
  await storage().remove(doc.storageKey).catch(() => undefined);
  await audit(ctx, { action: 'delete', entity: 'document', entityId: doc._id, projectId: doc.projectId, summary: `Deleted ${DOCUMENT_TYPE_LABELS[doc.type]}: ${doc.originalName}` });
  return { ok: true };
}

/** Used by the seed script: store a buffer as a document without HTTP. */
export async function storeDocument(ctx: Ctx, file: UploadedFile, meta: z.infer<typeof documentMetaSchema>) {
  return uploadDocument(ctx, file, meta);
}
