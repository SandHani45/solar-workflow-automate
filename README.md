# SolarFlow: run your solar business from lead to profit

SolarFlow is a multi-tenant SaaS for rooftop-solar installation companies. It follows the company
SOP (7 phases, 23 stages) for every customer project, from the first quotation to the net meter,
handover, service tickets and the partners' profit split, with role-based access for every team.

| Phase | Stages |
|---|---|
| 1 · Sales | Quotation → Site survey (roof, floors, shading) → Final quotation and order |
| 2 · Documents & finance | KYC documents · BOQ · Subsidy and bank loan · Advance collection |
| 3 · Logistics | Warehouse material check · Dispatch planning · Unloading · Engineer allocation |
| 4 · Installation | Schedule date · Installation · Site photos |
| 5 · Accounts | Expenses and bills · Warranty, invoice, DCR, agreement, feasibility letter |
| 6 · Net-metering & handover | DISCOM submission · AE inspection · Net meter · Client training · Google review |
| 7 · Closure | Full payment check · Profit sheet |
| Service | Tickets with SLA, AMC visits |

Independent tracks run in parallel. Each stage is gated by required documents, a checklist,
form fields and payment thresholds. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Stack

- **Web:** Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query (`apps/web`)
- **API:** Node.js 22, Express 5, Mongoose, zod, JWT cookie auth (`apps/api`)
- **Database:** MongoDB 7
- **Shared:** `packages/shared` holds the permissions, roles, feature flags, workflow engine, schemas and finance math used by both apps
- **Ops:** Docker Compose, GitHub Actions CI

## Quick start (Docker)

```bash
cp .env.example .env        # set secrets
docker compose up -d --build
docker compose exec api node dist/seed.js   # demo data
open http://localhost:3000
```

## Local development

```bash
corepack enable
pnpm install
docker compose -f docker-compose.dev.yml up -d   # MongoDB on :27017
cp .env.example apps/api/.env
pnpm seed                                        # demo org, users, projects
pnpm dev                                         # web :3000, api :4000
```

### Demo accounts (after seeding)

Every demo account uses the password `Demo@1234`.

| Role | Email |
|---|---|
| Owner / partner | owner@demo.solar |
| Admin | admin@demo.solar |
| Project manager | manager@demo.solar |
| Sales | sales@demo.solar |
| Operations / documentation | operations@demo.solar |
| Warehouse | warehouse@demo.solar |
| Project engineer | engineer@demo.solar |
| Accounts | accounts@demo.solar |
| Service | service@demo.solar |
| Customer (portal) | customer@demo.solar |
| Platform super admin | `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env` |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API and web app in watch mode |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Quality gates, also run in CI |
| `pnpm build` | Production builds |
| `pnpm seed` | Reset and seed the demo organisation |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [REST API contract](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md): Docker Compose, managed services, or Railway (config files included)
