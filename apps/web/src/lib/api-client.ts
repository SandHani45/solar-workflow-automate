import type { ListMeta, ListParams, Paginated, Session } from './types';

/** Same-origin base; `src/proxy.ts` forwards it to the API at runtime. */
export const API_BASE = '/api/v1';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** `STAGE_RULE` 422 → the list of unmet workflow rules. */
  get reasons(): string[] {
    const d = this.details as { reasons?: unknown } | undefined;
    return Array.isArray(d?.reasons) ? d.reasons.filter((r): r is string => typeof r === 'string') : [];
  }

  /** `VALIDATION_ERROR` 400 → zod `flatten()` field errors. */
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = Object.entries(err.fieldErrors);
    if (err.code === 'VALIDATION_ERROR' && fields.length > 0) {
      return fields.map(([k, msgs]) => `${k}: ${msgs[0] ?? 'invalid'}`).join('; ');
    }
    if (err.reasons.length > 0) return `${err.message}: ${err.reasons.join('; ')}`;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/** Auth endpoints never trigger refresh-and-retry (they are how you get a session). */
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password', '/auth/accept-invite', '/auth/invite/'];

const PUBLIC_PATHS = ['/', '/pricing', '/login', '/register', '/forgot-password', '/reset-password', '/invite'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

export function buildQuery(params?: ListParams): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Single-flight refresh ──
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      // Let concurrent 401s share this attempt, then allow a fresh one later.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    });
  return refreshInFlight;
}

let redirecting = false;
function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirecting) return;
  const { pathname, search } = window.location;
  if (isPublicPath(pathname)) return;
  redirecting = true;
  // Best effort: clear stale cookies so the proxy doesn't bounce /login back into the app.
  void fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(() => {
    // Outside React (no router here) and a full reload also clears stale client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?reauth=1&next=${encodeURIComponent(pathname + search)}`);
  });
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error (proxy failure, HTML 502 …)
  }
  const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  if (e) return new ApiError(res.status, e.code ?? 'INTERNAL', e.message ?? res.statusText, e.details);
  // The API always answers with a JSON envelope, so a bare 5xx means the proxy couldn't reach it
  // (Next.js reports a failed rewrite as a plain-text 500).
  if (res.status >= 500) {
    return new ApiError(res.status, 'UNAVAILABLE', 'The server is unreachable. Please try again shortly.');
  }
  return new ApiError(res.status, 'INTERNAL', res.statusText || 'Request failed');
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: ListParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Don't redirect to /login when the session can't be refreshed (e.g. marketing pages). */
  noRedirect?: boolean;
}

interface Envelope<T> {
  data: T;
  meta?: ListMeta;
}

async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<Envelope<T>> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}${buildQuery(opts.query)}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    signal: opts.signal,
    headers: opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  });

  if (res.status === 401 && !retried && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshSession()) return request<T>(path, opts, true);
    if (!opts.noRedirect) redirectToLogin();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return { data: undefined as T };
  return (await res.json()) as Envelope<T>;
}

export const api = {
  get: async <T>(path: string, query?: ListParams, opts?: Pick<RequestOptions, 'signal' | 'noRedirect'>) =>
    (await request<T>(path, { query, ...opts })).data,
  list: async <T>(path: string, query?: ListParams, opts?: Pick<RequestOptions, 'signal'>): Promise<Paginated<T>> => {
    const env = await request<T[]>(path, { query, ...opts });
    const data = env.data ?? [];
    return { data, meta: env.meta ?? { page: 1, limit: data.length, total: data.length, pages: 1 } };
  },
  post: async <T>(path: string, body?: unknown) => (await request<T>(path, { method: 'POST', body: body ?? {} })).data,
  patch: async <T>(path: string, body: unknown) => (await request<T>(path, { method: 'PATCH', body })).data,
  put: async <T>(path: string, body: unknown) => (await request<T>(path, { method: 'PUT', body })).data,
  delete: async <T = unknown>(path: string) => (await request<T>(path, { method: 'DELETE' })).data,

  /**
   * Multipart upload with progress (fetch has no upload progress). Mirrors `request`: parses the
   * envelope, refreshes once on 401.
   */
  upload<T>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
    const send = () =>
      new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}${path}`);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          let body: unknown = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            body = null;
          }
          resolve({ status: xhr.status, body });
        };
        xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Upload failed — check your connection'));
        xhr.send(form);
      });

    return (async () => {
      let res = await send();
      if (res.status === 401 && (await refreshSession())) res = await send();
      if (res.status === 401) redirectToLogin();
      if (res.status < 200 || res.status >= 300) {
        const e = (res.body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
        throw new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Upload failed', e?.details);
      }
      return (res.body as Envelope<T>).data;
    })();
  },
};

/** Current session or null when signed out. Never redirects (used by auth pages and guards). */
export async function fetchSession(): Promise<Session | null> {
  try {
    return await api.get<Session>('/auth/me', undefined, { noRedirect: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}

/** Where a user lands after signing in. */
export function homeFor(session: Session): string {
  if (session.user.isSuperAdmin) return '/platform';
  if (session.user.roleKey === 'customer') return '/portal';
  return '/dashboard';
}

/** Only allow same-origin relative `next` targets (prevents open redirects). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return null;
  return next;
}
