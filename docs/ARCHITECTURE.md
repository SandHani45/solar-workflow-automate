# SolarFlow — Architecture

SolarFlow is a multi-tenant SaaS that runs a rooftop-solar installation business end to end,
from lead to profit. It is built around the company SOP (7 phases, 23 workflow stages), and each
customer project moves through that SOP as a stage graph.

## 1. Product scope

| Area | What it does | SOP steps |
|---|---|---|
| Leads CRM | Capture leads, follow-ups, activity log, kanban pipeline, convert to project | pre-1 |
| Sales | Quotations (versioned, GST, printable), site survey form, order gain | 1–3 |
| Documents & finance | KYC documents, BOQ, PM Surya Ghar subsidy, bank loan, advance collection | 4–7 |
| Logistics | Warehouse stock, material check, dispatch planning, unloading, engineer allocation | 8–11 |
| Installation | Schedule, installation checklist with serial numbers, site photos | 12–14 |
| Accounts | Site expenses and bills with approval, warranty/invoice/DCR/agreement uploads | 15–16 |
| Net-metering & handover | DISCOM submission, AE inspection, net meter, client training, Google review | 17–22 |
| Closure | Full-payment check, profit sheet | 23 |
| Service | Tickets with SLA, assignment and resolution; AMC contracts with scheduled visits | 24–26 |
| Finance dashboard | Pending payments by customer, collections by mode (PhonePe/company account/cash…), expenses, employee and partner advances, warehouse stock value, profit, split between partners | 27 |

### Additions beyond the SOP (from comparable products)

The additions below come from established solar CRM and operations products (OpenSolar, Arka360,
Enerflo, SolarSuccess, Aurora) and common Indian EPC practice:

- **Stage DAG with parallel tracks.** Documentation, logistics and accounts run in parallel once the
  advance is received, which cuts cycle time. The two SOP diagrams already show this as parallel columns.
- **Gating rules.** A stage cannot close until its required documents, checklist, form fields and
  payment thresholds are met. This stops "installed but no advance" and "closed but unpaid" cases.
- **SLA per stage and overdue tracking.** Each stage has a turnaround in days, and a "My tasks" inbox lists work per role.
- **Customer portal.** The customer sees progress, documents, payments and service tickets, which cuts phone follow-ups.
- **Weighted-average stock costing and material-cost-per-project.** This gives true per-project profit, not just cash in minus cash out.
- **AMC contracts** with auto-generated cleaning visits, a recurring-revenue line for the business.
- **Audit log, CSV exports, global search and in-app notifications.**
- **Configurable workflow per tenant.** Admins can rename, reorder, add, disable and re-own stages. Each project snapshots its workflow version.
- **Feature flags** at three levels: platform default, then tenant override (can be locked by the platform), then role restriction.

## 2. System overview

```
┌──────────────┐  same-origin /api/v1/*  ┌──────────────┐   Mongoose   ┌───────────┐
│  apps/web    │ ─────── rewrite ──────▶ │  apps/api    │ ───────────▶ │  MongoDB  │
│  Next.js 16  │   httpOnly JWT cookies  │  Express 5   │              │  7.x      │
│  App Router  │ ◀────────────────────── │  Node 22     │ ──▶ uploads volume (local/S3)
└──────────────┘                         └──────────────┘
        ▲                                        ▲
        └────────── packages/shared ─────────────┘
   (permissions, roles, feature flags, workflow definition + engine helpers, zod schemas, finance math)
```

- **Monorepo:** pnpm workspaces. `packages/shared` is TypeScript source consumed directly: the web app
  uses Next `transpilePackages`, and the API bundles it with tsup.
- **Why a separate API:** it can be deployed and scaled independently, is usable by a future mobile
  app for site engineers, and keeps a clear backend and frontend split.
- **Auth:** email and password (bcrypt), short-lived access JWT plus a rotating refresh JWT in httpOnly
  cookies, and invite links for team members and customers.
- **Authorisation:** `requireAuth` → `requireFeature(key)` → `requirePermission(perm)` middleware, plus
  row-level scoping (own leads, assigned projects, customer's own project) in services.
- **Multi-tenancy:** shared database with an `orgId` on every tenant document, compound indexes that start with `orgId`, and the org id always taken from the session.

## 3. Repository layout

```
apps/
  api/            Express API (src/modules/<domain>/{model,service,routes}.ts)
  web/            Next.js app (app/(marketing), app/(auth), app/(app), app/platform)
packages/
  shared/         Domain contract shared by both apps
docs/             ARCHITECTURE.md, API.md, DEPLOYMENT.md
docker-compose.yml          production-like stack (mongo, api, web)
docker-compose.dev.yml      MongoDB only, for local dev
```

## 4. Roles (defaults, all editable)

`owner`, `admin`, `manager`, `sales`, `operations`, `warehouse`, `engineer`, `accounts`, `service`,
`customer`, plus platform `super_admin`. See `packages/shared/src/roles.ts`. Admins can create custom
roles from the permission catalogue (`permissions.ts`).

## 5. Quality

- Shared domain logic is unit tested (vitest).
- API: integration tests with supertest and mongodb-memory-server cover auth, RBAC, tenancy isolation, the workflow engine rules and finance maths.
- Web: typecheck, lint, and Playwright smoke tests of the main journeys.
- CI: GitHub Actions runs install, typecheck, lint, test and build for every package.
