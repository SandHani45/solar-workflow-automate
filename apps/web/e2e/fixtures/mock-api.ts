/**
 * Minimal in-browser mock of the SolarFlow API (docs/API.md shapes) via Playwright route
 * interception. Used for screenshots and UI tests that must run without the backend.
 * It is deliberately small: realistic data for dashboard + project workflow, empty lists elsewhere.
 */
import type { BrowserContext, Page, Route } from '@playwright/test';
import { ALL_PERMISSIONS, computeStageAvailability, currentPhase, DEFAULT_STAGES, FEATURE_KEYS, projectProgress, type StageStatus } from '@solar/shared';

const now = Date.now();
const iso = (days: number) => new Date(now + days * 86_400_000).toISOString();
const ref = (id: string, name: string, roleKey: string) => ({ id, name, email: `${roleKey}@demo.solar`, roleKey });

const OWNER = ref('u0000000000000000000001', 'Ananya Sharma', 'owner');
const ENGINEER = ref('u0000000000000000000007', 'Ravi Kumar', 'engineer');
const SALES = ref('u0000000000000000000004', 'Priya Verma', 'sales');
const MANAGER = ref('u0000000000000000000003', 'Vikram Singh', 'manager');

export function mockSession(roleKey = 'owner') {
  return {
    user: { id: OWNER.id, name: OWNER.name, email: OWNER.email, roleKey, isSuperAdmin: false },
    org: { id: 'o1', name: 'Suryodaya Solar Pvt Ltd', slug: 'suryodaya', plan: 'growth', settings: { advancePercent: 30, defaultGstPercent: 12, phone: '+91 98290 11111', gstin: '08ABCDE1234F1Z5' } },
    role: { key: roleKey, name: 'Owner / Partner', permissions: ALL_PERMISSIONS },
    permissions: ALL_PERMISSIONS,
    features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])),
  };
}

const DONE_THROUGH = 12; // steps 1..12 completed
function buildProject() {
  let stages = DEFAULT_STAGES.map((d) => ({
    key: d.key,
    status: (d.step <= DONE_THROUGH ? 'completed' : 'locked') as StageStatus,
    checklist: d.checklist.map((label) => ({ label, done: d.step <= DONE_THROUGH })),
    data: {} as Record<string, unknown>,
    notes: [] as { body: string; by: typeof OWNER; at: string }[],
    completedAt: d.step <= DONE_THROUGH ? iso(-30 + d.step * 2) : undefined,
    completedBy: d.step <= DONE_THROUGH ? MANAGER : undefined,
    dueAt: undefined as string | undefined,
    assignee: undefined as typeof ENGINEER | undefined,
  }));
  stages = computeStageAvailability(stages, DEFAULT_STAGES);
  stages = stages.map((s) => {
    if (s.key === 'installation') return { ...s, status: 'in_progress' as const, dueAt: iso(1), assignee: ENGINEER, checklist: s.checklist.map((c, i) => ({ ...c, done: i < 4 })), data: { inverterSerial: 'GW5K-DT-2231' } };
    if (s.key === 'expenses_bills') return s;
    if (s.status === 'pending') return { ...s, dueAt: iso(-2) };
    return s;
  });
  return {
    id: 'p0000000000000000000042',
    code: 'SP-2026-0042',
    status: 'active',
    customer: { name: 'Rajesh Sharma', phone: '+91 98290 42424', email: 'rajesh@example.com', address: { line1: '14, Shanti Nagar', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', pincode: '302018' }, consumerNumber: 'JVVNL-2104412' },
    customerType: 'residential',
    connectionType: 'on_grid',
    systemSizeKw: 5.4,
    contractValue: 315000,
    expectedSubsidy: 78000,
    team: { sales: SALES, manager: MANAGER, engineer: ENGINEER },
    workflowVersion: 3,
    stageDefinitions: DEFAULT_STAGES,
    stages,
    currentPhase: currentPhase(stages, DEFAULT_STAGES),
    progress: projectProgress(stages),
    boq: [
      { itemId: 'i1', description: 'Waaree 545Wp Mono PERC bifacial (DCR)', quantity: 10, unit: 'nos', unitCost: 14200 },
      { itemId: 'i2', description: 'Growatt 5kW on-grid inverter', quantity: 1, unit: 'nos', unitCost: 42000 },
      { description: 'HDG mounting structure', quantity: 5.4, unit: 'kW', unitCost: 5200 },
    ],
    subsidy: { status: 'applied', applicationNo: 'PMSG-RJ-88213', amount: 78000 },
    loan: { status: 'not_required' },
    netMetering: { status: 'not_started' },
    installationDate: iso(0),
    documentsCount: 9,
    financialSummary: { received: 220500, pending: 94500 },
    createdAt: iso(-34),
    updatedAt: iso(-1),
  };
}

const DOC_TYPES = ['survey_photo', 'aadhaar', 'pan', 'bank_passbook', 'electricity_bill', 'quotation', 'module_photo'];
function buildDocuments(projectId: string) {
  return DOC_TYPES.map((type, i) => ({
    id: `d${i}`,
    projectId,
    type,
    stageKey: undefined,
    originalName: `${type}.${type.endsWith('photo') ? 'jpg' : 'pdf'}`,
    mimeType: type.endsWith('photo') ? 'image/jpeg' : 'application/pdf',
    size: 180_000 + i * 21_000,
    url: `/api/v1/documents/d${i}/download`,
    uploadedBy: SALES,
    createdAt: iso(-20 + i),
  }));
}

function buildDashboard(project: ReturnType<typeof buildProject>) {
  return {
    kpis: { activeProjects: 38, completedThisMonth: 6, newLeads: 27, pipelineValue: 8_450_000, collectedThisMonth: 2_180_000, openTickets: 5, overdueStages: 4, lowStockItems: 3 },
    projectsByPhase: [
      { phase: 'sales', count: 9 },
      { phase: 'documentation', count: 8 },
      { phase: 'logistics', count: 6 },
      { phase: 'installation', count: 7 },
      { phase: 'accounts', count: 3 },
      { phase: 'net_metering', count: 4 },
      { phase: 'closure', count: 1 },
    ],
    myTasks: [
      { projectId: project.id, projectCode: project.code, customerName: project.customer.name, stageKey: 'installation', stageName: 'Installation as per Schedule', status: 'in_progress', dueAt: iso(1), overdue: false },
      { projectId: project.id, projectCode: 'SP-2026-0039', customerName: 'Meena Agarwal', stageKey: 'site_photos', stageName: 'Site Team Uploads Photos', status: 'pending', dueAt: iso(-2), overdue: true },
      { projectId: project.id, projectCode: 'SP-2026-0045', customerName: 'Hotel Rajputana', stageKey: 'final_quotation', stageName: 'Final Quotation & Order Gain', status: 'in_progress', dueAt: iso(3), overdue: false },
      { projectId: project.id, projectCode: 'SP-2026-0031', customerName: 'Suresh Jain', stageKey: 'meter_fixing', stageName: 'Bi-directional Meter Fixing', status: 'pending', dueAt: iso(-5), overdue: true },
    ],
    recentActivity: [
      { id: 'a1', action: 'stage.completed', entity: 'project', entityId: project.id, summary: 'completed “Installation Schedule Date Fix” on SP-2026-0042', user: MANAGER, createdAt: iso(-0.1) },
      { id: 'a2', action: 'payment.created', entity: 'project', entityId: project.id, summary: 'recorded ₹94,500 via PhonePe for SP-2026-0042', user: ref('u8', 'Kavita Rao', 'accounts'), createdAt: iso(-0.4) },
      { id: 'a3', action: 'lead.created', entity: 'lead', entityId: 'l1', summary: 'added lead Anil Mehta (6 kW, referral)', user: SALES, createdAt: iso(-1) },
      { id: 'a4', action: 'document.uploaded', entity: 'project', entityId: project.id, summary: 'uploaded Electricity Bill to SP-2026-0039', user: ref('u5', 'Deepak Joshi', 'operations'), createdAt: iso(-1.5) },
    ],
    upcomingInstallations: [
      { projectId: project.id, projectCode: project.code, customerName: project.customer.name, date: iso(0), engineer: ENGINEER },
      { projectId: project.id, projectCode: 'SP-2026-0044', customerName: 'Kiran Textiles', date: iso(2), engineer: ENGINEER },
      { projectId: project.id, projectCode: 'SP-2026-0047', customerName: 'Pooja Nair', date: iso(4) },
    ],
    monthlyCollections: [
      { month: '2026-04', amount: 1_420_000 },
      { month: '2026-05', amount: 1_860_000 },
      { month: '2026-06', amount: 1_390_000 },
      { month: '2026-07', amount: 2_240_000 },
      { month: '2026-08', amount: 2_610_000 },
      { month: '2026-09', amount: 2_180_000 },
    ],
  };
}

const list = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, pages: 1, unread: 2 } });

export interface MockOptions {
  roleKey?: string;
}

/** Installs the mock on a page (call before navigation). Returns the mutable project for assertions. */
export async function installMockApi(page: Page, opts: MockOptions = {}) {
  const session = mockSession(opts.roleKey);
  const project = buildProject();
  const documents = buildDocuments(project.id);

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = req.method();

    if (path === '/auth/me' || path === '/auth/refresh' || path === '/auth/login') return json(route, { data: session });
    if (path === '/dashboard') return json(route, { data: buildDashboard(project) });
    if (path === '/projects' && method === 'GET') return json(route, list([project]));
    if (path === '/projects/board') return json(route, { data: { installation: [project] } });
    if (path === `/projects/${project.id}` && method === 'GET') return json(route, { data: project });
    if (path === `/projects/${project.id}/financials`) return json(route, { data: { contractValue: 315000, received: 220500, pending: 94500, payments: [] } });
    if (path.startsWith(`/projects/${project.id}/`) && method === 'GET') return json(route, { data: [] });

    const stageMatch = path.match(/^\/projects\/[^/]+\/stages\/([^/]+)$/);
    if (stageMatch && method === 'PATCH') {
      const key = stageMatch[1];
      const body = req.postDataJSON() as { status?: StageStatus; checklist?: { label: string; done: boolean }[]; data?: Record<string, unknown> };
      const def = DEFAULT_STAGES.find((d) => d.key === key)!;
      const stage = project.stages.find((s) => s.key === key)!;
      if (body.status === 'completed') {
        const present = new Set(documents.map((d) => d.type));
        const reasons = [
          ...def.requiredDocuments.filter((d) => !present.has(d)).map((d) => `Required document missing: ${d}`),
          ...((body.checklist ?? stage.checklist).some((c) => !c.done) ? ['All checklist items must be done'] : []),
        ];
        if (reasons.length) return json(route, { error: { code: 'STAGE_RULE', message: 'Stage cannot be completed', details: { reasons } } }, 422);
      }
      Object.assign(stage, { checklist: body.checklist ?? stage.checklist, data: { ...stage.data, ...body.data }, status: body.status ?? stage.status });
      if (body.status === 'completed') Object.assign(stage, { completedAt: new Date().toISOString(), completedBy: OWNER });
      project.stages = computeStageAvailability(project.stages, DEFAULT_STAGES);
      project.progress = projectProgress(project.stages);
      project.currentPhase = currentPhase(project.stages, DEFAULT_STAGES);
      return json(route, { data: project });
    }

    if (path === '/documents') return json(route, list(url.searchParams.get('projectId') ? documents : []));
    if (/^\/documents\/[^/]+\/download$/.test(path)) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#1e3a8a"/><g fill="#60a5fa">' + Array.from({ length: 12 }, (_, i) => `<rect x="${20 + (i % 4) * 92}" y="${40 + Math.floor(i / 4) * 80}" width="84" height="70" rx="4"/>`).join('') + '</g></svg>';
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
    }
    if (path === '/users/options') return json(route, { data: [OWNER, MANAGER, SALES, ENGINEER].map(({ id, name, roleKey }) => ({ id, name, roleKey })) });
    if (path === '/notifications') return json(route, list([{ id: 'n1', title: 'Installation due tomorrow', body: 'SP-2026-0042 · Rajesh Sharma', link: `/projects/${project.id}?stage=installation`, readAt: null, createdAt: iso(-0.2) }, { id: 'n2', title: 'Expense awaiting approval', body: '₹4,200 · MC4 connectors', link: '/finance/expenses', readAt: null, createdAt: iso(-1) }]));
    if (path === '/search') return json(route, { data: { projects: [{ id: project.id, code: project.code, customer: project.customer, currentPhase: project.currentPhase }], leads: [], tickets: [] } });
    if (method === 'GET') return json(route, list([]));
    return json(route, { data: { ok: true } });
  });

  return { project, session };
}

/** The proxy only lets requests with a session cookie into app routes. */
export async function addSessionCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: 'sf_access', value: 'mock', url: baseURL }]);
}
