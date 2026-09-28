import { paginationSchema } from '@solar/shared';
import type { SortOrder } from 'mongoose';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  q?: string;
  sort: Record<string, SortOrder>;
}

/**
 * Parse `page`, `limit`, `q`, `sort` from a query object. `sort` accepts `field` or
 * `-field`; only whitelisted fields are honoured (defaults to `-createdAt`).
 */
export function pageParams(query: unknown, allowedSort: string[] = ['createdAt', 'updatedAt'], defaultSort = '-createdAt'): PageParams {
  const raw0 = (query ?? {}) as Record<string, unknown>;
  // Be lenient with out-of-range values: clamp instead of rejecting (limit max 100).
  const num = (v: unknown, def: number, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : def;
  };
  const p = paginationSchema.parse({ ...raw0, page: num(raw0.page, 1, 1e6), limit: num(raw0.limit, 20, 100), q: typeof raw0.q === 'string' ? raw0.q.slice(0, 120) : undefined, sort: typeof raw0.sort === 'string' ? raw0.sort.slice(0, 40) : undefined });
  const raw = p.sort && allowedSort.includes(p.sort.replace(/^-/, '')) ? p.sort : defaultSort;
  const field = raw.replace(/^-/, '');
  const sort: Record<string, SortOrder> = { [field]: raw.startsWith('-') ? -1 : 1 };
  if (field !== '_id') sort._id = -1;
  return { page: p.page, limit: p.limit, skip: (p.page - 1) * p.limit, q: p.q || undefined, sort };
}

export const pageMeta = (page: number, limit: number, total: number): PageMeta => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});

/** Escape user input for use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const searchRegex = (q: string) => new RegExp(escapeRegex(q.trim()), 'i');
