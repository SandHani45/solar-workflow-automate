# SolarFlow REST API contract (v1)

This is the contract between `apps/api` (Express + MongoDB) and `apps/web` (Next.js).
Both sides MUST follow it. Request body shapes are the zod schemas in `@solar/shared`
(`packages/shared/src/schemas.ts`) — the names are given below.

## Conventions

- Base path: `/api/v1`. The web app calls the same-origin path `/api/v1/...`; Next.js rewrites it to
  `API_INTERNAL_URL` (default `http://localhost:4000`), so auth cookies are first-party.
- JSON everywhere except uploads (`multipart/form-data`) and CSV exports (`text/csv`).
- **Success envelope:** `{ "data": <payload> }`. Lists: `{ "data": [...], "meta": { "page", "limit", "total", "pages" } }`.
- **Error envelope:** `{ "error": { "code": string, "message": string, "details"?: any } }` with codes:
  `VALIDATION_ERROR` 400 (details = zod `flatten()` output), `UNAUTHENTICATED` 401, `FORBIDDEN` 403,
  `FEATURE_DISABLED` 403, `NOT_FOUND` 404, `CONFLICT` 409, `STAGE_RULE` 422 (workflow rule violated;
  details = `{ reasons: string[] }`), `RATE_LIMITED` 429, `INTERNAL` 500.
- List query params: `page` (1), `limit` (20, max 100), `q` (search), `sort` (e.g. `-createdAt`), plus
  per-resource filters listed below.
- All documents are JSON with `id` (string) instead of `_id`, no `__v`. Dates are ISO strings.
  Referenced users are populated as `{ id, name, email, roleKey }` where noted as `UserRef`.
- Multi-tenancy: every org-scoped document has `orgId`; the API derives it from the session and never
  trusts a client-supplied `orgId`.

## Auth (cookies)

Access token (JWT, 15 min) in httpOnly cookie `sf_access`; refresh token (JWT, 7 days, rotated,
stored hashed on the user session list) in httpOnly cookie `sf_refresh` scoped to path `/api/v1/auth`.
`SameSite=Lax`, `Secure` in production. The web client on a 401 calls `POST /auth/refresh` once and
retries; if that fails it redirects to `/login`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `registerOrgSchema` | `Session` — creates org (seeded roles + workflow) and owner user |
| POST | `/auth/login` | `loginSchema` | `Session` |
| POST | `/auth/refresh` | – | `Session` |
| POST | `/auth/logout` | – | `{ ok: true }` |
| GET | `/auth/me` | – | `Session` |
| POST | `/auth/change-password` | `changePasswordSchema` | `{ ok: true }` |
| POST | `/auth/forgot-password` | `forgotPasswordSchema` | `{ ok: true }` (always; token logged in dev) |
| POST | `/auth/reset-password` | `resetPasswordSchema` | `{ ok: true }` |
| GET | `/auth/invite/:token` | – | `{ email, orgName, roleName }` |
| POST | `/auth/accept-invite` | `acceptInviteSchema` | `Session` |

```ts
type Session = {
  user: { id; name; email; phone?; roleKey: string; isSuperAdmin: boolean; avatarUrl?; lastLoginAt? };
  org: { id; name; slug; plan; logoUrl?; settings: OrgSettings } | null; // null for super admin w/o org
  role: { key; name; permissions: string[] } | null;
  permissions: string[];                    // effective permissions
  features: Record<FeatureKey, boolean>;    // resolved for this user's role
};
```

## Organisation & settings  (`settings:manage` unless noted)

| Method | Path | Notes |
|---|---|---|
| GET | `/org` | any authenticated user; `{ id, name, slug, plan, settings, partners, features }` |
| PATCH | `/org` | `orgSettingsSchema` |
| GET | `/org/features` | `features:manage`; `[{ ...FeatureDefinition, enabled, roles, lockedByPlatform }]` |
| PUT | `/org/features` | `features:manage`; `orgFeatureUpdateSchema`; cannot enable a `lockedByPlatform` feature (403) |
| GET/PUT | `/org/partners` | `finance:partners`; `partnersSchema` |
| GET | `/org/workflow` | any authenticated; `{ version, phases: PhaseDefinition[], stages: StageDefinition[] }` |
| PUT | `/org/workflow` | `workflow:manage` + feature `workflow_customisation`; body `{ stages: StageDefinition[] }`; validated with `validateWorkflow`; bumps `version` |
| POST | `/org/workflow/reset` | `workflow:manage`; restore defaults |

## Users & roles

| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/users` | `users:read` | filters `roleKey`, `isActive`, `q` |
| POST | `/users` | `users:manage` | `inviteUserSchema`; returns `{ user, inviteUrl? }` |
| GET | `/users/:id` | `users:read` | |
| PATCH | `/users/:id` | `users:manage` | `updateUserSchema`; cannot demote/deactivate the last owner |
| DELETE | `/users/:id` | `users:manage` | soft delete (deactivate) |
| GET | `/users/options?role=engineer` | authenticated | lightweight `{ id, name, roleKey }[]` for pickers |
| GET | `/roles` | authenticated | `[{ id, key, name, description, permissions, isSystem, userCount }]` |
| POST | `/roles` | `roles:manage` | `roleSchema` |
| PATCH | `/roles/:id` | `roles:manage` | `roleSchema.partial()`; `owner` permissions immutable |
| DELETE | `/roles/:id` | `roles:manage` | only non-system roles with 0 users |
| GET | `/permissions` | authenticated | `{ groups: PERMISSION_GROUPS, labels: PERMISSION_LABELS }` |

## Dashboard

`GET /dashboard` (`dashboard:read`) — role-aware summary:
```ts
{
  kpis: { activeProjects; completedThisMonth; newLeads; pipelineValue; collectedThisMonth; openTickets; overdueStages; lowStockItems };
  projectsByPhase: { phase: PhaseKey; count: number }[];
  myTasks: { projectId; projectCode; customerName; stageKey; stageName; status; dueAt; overdue: boolean }[]; // stages the user's role owns or is assigned
  recentActivity: ActivityItem[];                // last 15 audit entries visible to the user
  upcomingInstallations: { projectId; projectCode; customerName; date; engineer?: UserRef }[];
  monthlyCollections: { month: 'YYYY-MM'; amount: number }[]; // last 6 months, only with finance:read
}
```

## Leads (feature `leads_crm`)

| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/leads` | `leads:read` | filters `status`, `source`, `assignedTo`, `q` (name/phone); users without `leads:assign` see only their own |
| POST | `/leads` | `leads:write` | `leadSchema` |
| GET | `/leads/:id` | `leads:read` | includes `activities[]` |
| PATCH | `/leads/:id` | `leads:write` | `leadSchema.partial()` |
| DELETE | `/leads/:id` | `leads:delete` | |
| POST | `/leads/:id/activities` | `leads:write` | `leadActivitySchema` |
| POST | `/leads/:id/convert` | `projects:write` | body `{ systemSizeKw, contractValue? }` → creates Project, sets lead `won` + `projectId`; returns project |
| GET | `/leads/board` | `leads:read` | `{ [status]: Lead[] }` for kanban |

Lead: `{ id, code: 'L-00012', name, phone, email, address, customerType, source, status, monthlyBill, requiredKw, assignedTo: UserRef|null, followUpAt, notes, lostReason, projectId, activities: {id,type,note,by:UserRef,at}[], createdAt, updatedAt }`

## Projects & workflow engine

| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/projects` | `projects:read` | filters `status`, `phase`, `stageKey`, `engineerId`, `q` (code/name/phone). Without `projects:read_all` only projects where user is on `team` (customers: `customerUserId` = self) |
| POST | `/projects` | `projects:write` | `projectSchema`; snapshots org workflow, stages initialised via `computeStageAvailability` |
| GET | `/projects/:id` | `projects:read` | full project |
| PATCH | `/projects/:id` | `projects:write` | `projectUpdateSchema` |
| DELETE | `/projects/:id` | `projects:delete` | soft delete (`deletedAt`) |
| PATCH | `/projects/:id/stages/:stageKey` | `workflow:advance` | `stageUpdateSchema` — see rules |
| POST | `/projects/:id/stages/:stageKey/reopen` | `workflow:override` | set back to `in_progress`, dependents that were completed stay completed |
| PUT | `/projects/:id/boq` | `projects:write` | `boqSchema` |
| GET | `/projects/:id/comments` / POST | `projects:read` | `commentSchema` |
| GET | `/projects/:id/timeline` | `projects:read` | audit entries for this project |
| GET | `/projects/:id/financials` | `payments:read` | `{ contractValue, received, pending, expenses, materialCost, profit, payments[], expenses[] }` (profit fields only with `finance:read`) |
| POST | `/projects/:id/customer-access` | `users:manage` + feature `customer_portal` | creates/links a `customer` role user for the project's customer email; returns `{ user, inviteUrl }` |
| GET | `/projects/board` | `projects:read` | `{ [phase]: ProjectSummary[] }` |

```ts
type Project = {
  id; code: 'SP-2026-0001'; status: ProjectStatus; customer: { name; phone; email; address; consumerNumber };
  customerType; connectionType; systemSizeKw; contractValue; expectedSubsidy;
  team: { sales?: UserRef; manager?: UserRef; engineer?: UserRef; operations?: UserRef };
  customerUserId?: string; leadId?;
  workflowVersion: number;
  stageDefinitions: StageDefinition[];   // snapshot used by this project
  stages: {
    key; status: StageStatus; assignee?: UserRef; startedAt?; completedAt?; completedBy?: UserRef; dueAt?;
    checklist: { label; done }[]; data: Record<string, unknown>; notes: { body; by: UserRef; at }[]; blockedReason?;
  }[];
  currentPhase: PhaseKey; progress: number;  // 0-100
  boq: { itemId?; description; quantity; unit; unitCost }[];
  survey?: { roofType; floors; shadowFreeAreaSqft; sanctionedLoadKw; surveyDate; notes };
  subsidy: { status: SubsidyStatus; applicationNo?; amount? };
  loan: { status: LoanStatus; bank?; amount? };
  netMetering: { status: NetMeteringStatus; applicationNo?; meterNumber?; inspectionDate? };
  installationDate?; completedAt?; rating?;
  documentsCount: number; financialSummary?: { received; pending };  // on list + detail
  createdAt; updatedAt;
};
```

**Stage rules** (enforced by the API, 422 `STAGE_RULE` with every failing reason):
1. Stage must not be `locked` (all `dependsOn` stages completed/skipped) — unless `workflow:override`.
2. User's role must be in `ownerRoles` or be `owner`/`admin`, or have `workflow:override`, or be the stage `assignee`.
3. On `completed`: every `requiredDocuments` type has ≥1 document on the project; all checklist items done;
   all `required` fields present in `data`; `requiresAdvancePayment` → received ≥ `org.settings.advancePercent`% of contractValue;
   `requiresFullPayment` → received ≥ contractValue − (subsidy credited to customer, if any is recorded as `subsidy` payments counts as received).
4. `skipped` only if stage is `optional` (or user has `workflow:override`).
5. Stages with a disabled `feature` are auto-`skipped` at project creation and whenever features change (on read).
6. After any change: recompute availability, `currentPhase`, `progress`; set `dueAt = now + slaDays` for newly unlocked stages;
   run automations (see `StageAutomation` in shared): e.g. `final_quotation` copies `finalKw`/`contractValue` into the project,
   `site_survey` copies data into `project.survey`, `engineer_allocation` sets `team.engineer`, `installation_schedule` sets
   `installationDate`, net-metering stages update `netMetering`, `subsidy_loan` updates `subsidy`/`loan`, `dispatch_planning`
   creates a Dispatch from the BOQ if none exists, `close_project` sets `status=completed`, `completedAt`.
7. Write an audit entry and notify the next stages' owner roles / assignees.

## Quotations (feature `quotations`)

| Method | Path | Perm |
|---|---|---|
| GET | `/quotations?projectId=&leadId=&status=` | `quotations:read` |
| POST | `/quotations` | `quotations:write` — `quotationSchema`; totals via `computeQuotationTotals`; auto `number: 'Q-2026-0001'`, `version` increments per project/lead; previous `sent` versions become `superseded` when a new one is sent |
| GET | `/quotations/:id` | `quotations:read` — includes org header info for printing |
| PATCH | `/quotations/:id` | `quotations:write` — only while `draft` |
| POST | `/quotations/:id/status` | `{ status: 'sent'|'accepted'|'rejected' }`; `accepted` requires `quotations:approve` and, for `kind=final` on a project, sets project `contractValue` |

## Documents

| Method | Path | Perm |
|---|---|---|
| GET | `/documents?projectId=&type=&stageKey=` | `documents:read` |
| POST | `/documents` | `documents:write` — multipart: `file` (max 15 MB; pdf, jpg, png, webp, heic) + fields of `documentMetaSchema` |
| GET | `/documents/:id/download` | `documents:read` — streams the file (`Content-Disposition`) |
| DELETE | `/documents/:id` | `documents:delete` |

Document: `{ id, projectId, type, stageKey, originalName, mimeType, size, url: '/api/v1/documents/:id/download', uploadedBy: UserRef, note, createdAt }`.
Storage driver interface (`local` default at `UPLOAD_DIR`, `s3` optional via env).

## Inventory & dispatch (features `inventory`, `dispatch`)

| Method | Path | Perm |
|---|---|---|
| GET | `/inventory/items?category=&lowStock=true&q=` | `inventory:read` — items include `quantity`, `reserved`, `available`, `stockValue` |
| POST | `/inventory/items` | `inventory:write` — `itemSchema` |
| PATCH | `/inventory/items/:id` | `inventory:write` |
| DELETE | `/inventory/items/:id` | `inventory:write` (archive) |
| GET | `/inventory/movements?itemId=&projectId=` | `inventory:read` |
| POST | `/inventory/movements` | `in`/`return`: `inventory:write`; `out`/`adjust`: `inventory:adjust`. `out` can't exceed quantity (409). `in` updates weighted-average `costPrice` |
| GET | `/inventory/summary` | `inventory:read` — `{ totalItems, totalValue, lowStock: Item[], byCategory: {category, value, quantity}[] }` |
| GET | `/dispatches?projectId=&status=` | `dispatch:read` |
| POST | `/dispatches` | `dispatch:write` — `dispatchSchema`; code `D-0001` |
| GET | `/dispatches/:id` | `dispatch:read` |
| POST | `/dispatches/:id/status` | `dispatch:write` — `dispatchStatusSchema`; on `in_transit` creates `out` movements (idempotent) at item cost → material cost for the project; `cancelled` after dispatch creates `return` movements |

## Finance (features `expenses`, `finance_dashboard`, `partner_profit_split`)

| Method | Path | Perm |
|---|---|---|
| GET | `/payments?projectId=&mode=&from=&to=` | `payments:read` (customer: only own projects) |
| POST | `/payments` | `payments:write` — `paymentSchema`; receipt no `R-2026-0001` |
| DELETE | `/payments/:id` | `payments:write` (soft, audited) |
| GET | `/expenses?projectId=&category=&status=&from=&to=` | `expenses:read` (engineers see their own) |
| POST | `/expenses` | `expenses:write` — `expenseSchema`; status `pending` (auto `approved` if user has `expenses:approve`) |
| POST | `/expenses/:id/decision` | `expenses:approve` — `expenseDecisionSchema` |
| DELETE | `/expenses/:id` | `expenses:write` (own + pending only, or `expenses:approve`) |
| GET | `/advances` / POST | `finance:read` / `finance:partners` — `advanceSchema` |
| POST | `/advances/:id/settle` | `finance:partners` |
| GET | `/finance/dashboard?from=&to=` | `finance:read` + feature `finance_dashboard` |

```ts
// GET /finance/dashboard
{
  totals: { contractValue; received; pending; expenses; materialCost; advancesOutstanding; stockValue; profit };
  receivedByMode: { mode: PaymentMode; amount }[];
  expensesByCategory: { category: ExpenseCategory; amount }[];
  pendingCustomers: { projectId; code; customerName; phone; contractValue; received; pending; lastPaymentAt? }[]; // pending > 0, sorted desc
  advances: { personName; kind; outstanding }[];
  partnerSplit: ProfitSplitRow[];      // only with finance:partners and feature partner_profit_split
  monthly: { month; received; expenses }[];  // last 12 months
  projectProfit: { projectId; code; customerName; received; expenses; materialCost; profit }[];
}
```

## Service (features `service_tickets`, `amc_contracts`)

| Method | Path | Perm |
|---|---|---|
| GET | `/tickets?status=&priority=&assigneeId=&projectId=` | `tickets:read` (customer: own; service/engineer without `tickets:assign`: assigned to them or unassigned) |
| POST | `/tickets` | `tickets:write` — `ticketSchema`; code `T-0001`; `dueAt` from `TICKET_SLA_HOURS` |
| GET | `/tickets/:id` | `tickets:read` — includes `comments[]` |
| PATCH | `/tickets/:id` | `tickets:write` — `ticketUpdateSchema`; `assigneeId` needs `tickets:assign`; customers can only move `resolved → closed` or reopen (`open`) |
| POST | `/tickets/:id/comments` | `tickets:write` — `commentSchema` |
| GET/POST | `/amc` | `tickets:read`/`tickets:write` — `amcSchema`; visits auto-generated |
| PATCH | `/amc/:id/visits/:visitId` | `tickets:write` — `{ done: boolean, note? }` |

Ticket: `{ id, code, projectId, project: { code, customerName }, subject, description, category, priority, status, assignee: UserRef|null, raisedBy: UserRef, dueAt, overdue, resolvedAt, closedAt, resolution, comments: {id, body, by: UserRef, at}[], createdAt }`

## Notifications, audit, reports, search

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?unread=true` | own notifications `{ id, title, body, link, readAt, createdAt }` + `meta.unread` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | |
| GET | `/audit?entity=&entityId=&userId=` | `audit:read` + feature `audit_log` — `{ id, action, entity, entityId, summary, user: UserRef, changes?, createdAt }` |
| GET | `/reports/:kind.csv` | `reports:export` + feature `reports_export`; kind ∈ `projects, leads, payments, expenses, inventory, tickets` |
| GET | `/search?q=` | global search `{ projects[], leads[], tickets[] }` (≤5 each, permission-filtered) |

## Platform (super admin only — `user.isSuperAdmin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/platform/stats` | `{ orgs, activeOrgs, users, projects }` |
| GET | `/platform/orgs` | list tenants with counts |
| GET | `/platform/orgs/:id` | detail incl. resolved features |
| PATCH | `/platform/orgs/:id` | `platformOrgUpdateSchema` (plan, activate/suspend, feature overrides + locks) |
| GET | `/platform/features` | catalogue (DB-backed, seeded from `FEATURE_CATALOGUE`) |
| PATCH | `/platform/features/:key` | `{ name?, description?, defaultEnabled? }` |

## Health

`GET /health` → `{ status: 'ok', db: 'up'|'down', uptime, version }` (no auth, used by Docker healthcheck).
