# @solar/api

SolarFlow REST API: Express 5, Mongoose 9 (MongoDB 7), zod v4, TypeScript. It implements the
contract in [`docs/API.md`](../../docs/API.md) under `/api/v1`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | `tsx watch src/index.ts`. Reads `.env` from `apps/api` or the repo root. |
| `pnpm build` | Uses tsup to bundle `src/index.ts` and `src/seed.ts` (with `@solar/shared` inlined) into `dist/`. |
| `pnpm start` | `node dist/index.js` |
| `pnpm seed` | Drops and recreates the demo org **Suryodaya Solar Pvt Ltd** (`*@demo.solar` / `Demo@1234`). In Docker, run `node dist/seed.js` instead. |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / ESLint flat config with typescript-eslint |
| `pnpm test` | vitest, supertest and mongodb-memory-server. Set `MONGOMS_SYSTEM_BINARY=/path/to/mongod` to use a local mongod instead of downloading one. |

## Environment

The API validates its environment with zod in `src/config/env.ts`. See `.env.example` at the repo root.

| Var | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | In `production`, both JWT secrets must be at least 32 characters and cookies are `Secure`. |
| `PORT` | `4000` | |
| `MONGODB_URI` | `mongodb://localhost:27017/solarflow` | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev placeholders | |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | `15m` / `7d` | |
| `APP_URL` | `http://localhost:3000` | Used for CORS and for invite and reset links. |
| `UPLOAD_DIR` | `./uploads` | Root of the local storage driver. |
| `MAX_UPLOAD_MB` | `15` | |
| `STORAGE_DRIVER` | `local` | `s3` is only an interface stub. See `src/lib/storage.ts`. |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | – | Creates the platform super admin on boot if none exists. |
| `LOG_LEVEL` | `info` | pino |
| `BCRYPT_ROUNDS` | `12` (`4` in tests) | |
| `BUSINESS_TZ` | `Asia/Kolkata` | Timezone used for monthly dashboard buckets. |

## Layout

```
src/
  index.ts              boot: connect db, sync feature catalogue, ensure super admin, listen, graceful shutdown
  app.ts                createApp(): helmet, cors, pino-http, body parsing, key sanitising, routers, 404, error handler
  config/env.ts         zod-validated env
  lib/                  db, mongoose (global toJSON plugin), logger, jwt, errors (AppError), http (envelopes),
                        pagination, serialize, sequence (atomic per-org codes), csv, storage, time, context
  middleware/           auth (requireAuth/requireOrg/requireSuperAdmin/requirePermission/requireFeature),
                        validate (body/query + `$`/`.` key rejection), error
  modules/<domain>/     model.ts · service.ts · routes.ts
    auth org users roles dashboard leads projects (+ workflow.service.ts, access.ts) quotations
    documents inventory dispatches payments expenses advances finance tickets amc
    notifications audit reports search platform health
  seed.ts               demo data. Projects are advanced through the real workflow engine.
test/                   integration tests (one in-memory mongod, one database per file)
```

The services always take a `Ctx` (the user, the org, permissions and resolved features) and filter by
`ctx.orgOid`. Row-level scoping lives in `projects/access.ts`, `leadScope`, `ticketScope` and
`expenseScope`.
