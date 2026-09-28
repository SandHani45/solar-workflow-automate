import type { NextConfig } from 'next';

/**
 * API proxying
 * ------------
 * The browser always calls the same-origin path `/api/v1/*` so the API's httpOnly auth cookies are
 * first-party. Forwarding to the API happens in `src/proxy.ts` (Next 16's renamed middleware), NOT
 * in `rewrites()` here: `rewrites()` is evaluated once at `next build` and frozen into the standalone
 * output, which would bake the build machine's `API_INTERNAL_URL` into the Docker image. The proxy
 * runs on the Node.js runtime for every request and reads `process.env.API_INTERNAL_URL` at runtime
 * (default `http://localhost:4000`), so one image works in every environment.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@solar/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo: trace workspace files (packages/shared) from the repo root into the standalone bundle.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  experimental: {
    // Uploads go through the proxy, which buffers request bodies. API limit is 15 MB per file.
    proxyClientMaxBodySize: '20mb',
  },
};

export default nextConfig;
