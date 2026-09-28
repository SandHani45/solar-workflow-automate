# @solar/web

The Next.js 16 (App Router) frontend for SolarFlow.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` / `pnpm start` | Production build (`output: 'standalone'`) and server |
| `pnpm typecheck` / `pnpm lint` | Quality gates |
| `pnpm test:e2e:mocked` | Playwright against an in-browser API mock (no backend needed) |
| `pnpm test:e2e` | Playwright against the real stack (API running and seeded, web on :3000) |

## API proxy

The browser always calls the same-origin path `/api/v1/*`. `src/proxy.ts` (Next 16's renamed middleware)
forwards those requests on every request to `process.env.API_INTERNAL_URL`, which defaults to
`http://localhost:4000`. In Docker Compose it is `http://api:4000`. The URL is read at runtime, not baked in
at build time, so one image works in any environment, and the auth cookies stay first-party. Request
bodies are limited to 20 MB (`proxyClientMaxBodySize`) to allow 15 MB document uploads.

The same file also redirects signed-out users away from app routes, and signed-in users away from `/login` and `/register`.

## Layout

- `src/app/(marketing)`: landing and pricing pages
- `src/app/(auth)`: login, register, invite and password reset
- `src/app/(app)`: the authenticated app; navigation is filtered by permission and feature
- `src/app/platform`: super-admin console
- `src/components/ui`: the in-house component library
- `src/components/<feature>`: feature components (the workflow stage drawer is in `workflow/`)
- `src/hooks`: session, permission and feature checks, plus per-resource query hooks
- `src/lib/api-client.ts`: fetch wrapper that unwraps the response envelope and refreshes the session once on a 401
