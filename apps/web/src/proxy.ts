import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 proxy (formerly middleware). Two jobs:
 *
 * 1. Runtime API proxy — `/api/v1/*` is rewritten to `${API_INTERNAL_URL}/api/v1/*`. Because this
 *    runs per request on the Node.js runtime, `API_INTERNAL_URL` is read when the server starts, not
 *    when the image is built (unlike `rewrites()` in next.config). Default: http://localhost:4000.
 *
 * 2. Route guard — app routes need a session cookie; signed-in users skip /login and /register.
 *    Only cookie *presence* is checked here (the API verifies tokens). `sf_refresh` is path-scoped to
 *    /api/v1/auth, so page requests normally only carry `sf_access`; when it has expired the login
 *    page silently tries `POST /auth/refresh` before showing the form.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/leads',
  '/projects',
  '/quotations',
  '/documents',
  '/inventory',
  '/dispatches',
  '/finance',
  '/service',
  '/reports',
  '/team',
  '/settings',
  '/notifications',
  '/profile',
  '/portal',
  '/platform',
];

const GUEST_ONLY = ['/login', '/register'];

function apiOrigin(): string {
  return (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiOrigin()));
  }

  const hasSession = request.cookies.has('sf_access') || request.cookies.has('sf_refresh');

  if (!hasSession && matches(pathname, PROTECTED_PREFIXES)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // `reauth=1` means the app found the cookie stale — let the user reach the form (avoids loops).
  if (hasSession && matches(pathname, GUEST_ONLY) && !request.nextUrl.searchParams.has('reauth')) {
    const next = request.nextUrl.searchParams.get('next');
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*', '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
