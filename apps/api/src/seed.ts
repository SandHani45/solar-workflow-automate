/**
 * Demo data: `pnpm seed` (dev) or `node dist/seed.js` (Docker).
 *
 * Idempotent-ish: drops and recreates ONLY the demo organisation "Suryodaya Solar Pvt Ltd"
 * (slug `suryodaya-solar`) and its `@demo.solar` users. Projects are advanced through the
 * real workflow engine, so every stage rule and automation is exercised.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { DEFAULT_ROLES, DEFAULT_STAGES, type PaymentMode, type StageUpdateInput } from '@solar/shared';
import { env } from './config/env';
import type { Ctx } from './lib/context';
import { oid } from './lib/context';
import { connectDb, disconnectDb } from './lib/db';
import { logger } from './lib/logger';
import { mongoose } from './lib/mongoose';
import { contextForUserId } from './middleware/auth';
import { createAdvance, settleAdvance } from './modules/advances/service';
import { createAmc, updateVisit } from './modules/amc/service';
import { ensureSuperAdmin } from './modules/auth/service';
import { setDispatchStatus } from './modules/dispatches/service';
import { Dispatch } from './modules/dispatches/model';
import { storeDocument } from './modules/documents/service';
import { createExpense, decideExpense } from './modules/expenses/service';
import { applyMovement, createItem } from './modules/inventory/service';
import { addActivity, convertLead, createLead } from './modules/leads/service';
import { Lead } from './modules/leads/model';
import { Org } from './modules/org/model';
import { createOrganisation } from './modules/org/service';
import { createPayment } from './modules/payments/service';
import { syncFeatureCatalogue } from './modules/platform/catalogue';
import { Project } from './modules/projects/model';
import { createProject, setBoq } from './modules/projects/service';
import { updateStage } from './modules/projects/workflow.service';
import { createQuotation, setQuotationStatus } from './modules/quotations/service';
import { addTicketComment, createTicket, updateTicket } from './modules/tickets/service';
import { User } from './modules/users/model';

const DEMO_SLUG = 'suryodaya-solar';
const DEMO_DOMAIN = 'demo.solar';
const DEMO_PASSWORD = 'Demo@1234';
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a30000000049454e44ae426082', 'hex');
const pdf = (title: string) => Buffer.from(`%PDF-1.4\n% SolarFlow demo placeholder: ${title}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const PHOTO_TYPES = new Set(['site_photo', 'module_photo', 'inverter_photo', 'survey_photo']);

const USER_NAMES: Record<string, string> = {
  owner: 'Arjun Mehta',
  admin: 'Neha Kapoor',
  manager: 'Vikram Singh',
  sales: 'Priya Sharma',
  operations: 'Karan Desai',
  warehouse: 'Suresh Yadav',
  engineer: 'Imran Shaikh',
  accounts: 'Pooja Iyer',
  service: 'Rahul Verma',
  customer: 'Meera Joshi',
};

async function purgeDemo(): Promise<void> {
  const org = await Org.findOne({ slug: DEMO_SLUG }).lean();
  if (org) {
    for (const m of Object.values(mongoose.models)) {
      if (m.schema.path('orgId') && m.modelName !== 'Org') await m.deleteMany({ orgId: org._id });
    }
    await Org.deleteOne({ _id: org._id });
    if (env.STORAGE_DRIVER === 'local') await fs.rm(path.join(env.uploadDir, String(org._id)), { recursive: true, force: true });
    logger.info('Removed previous demo organisation');
  }
  await User.deleteMany({ email: new RegExp(`@${DEMO_DOMAIN.replace('.', '\\.')}$`) });
}

async function main(): Promise<void> {
  await connectDb();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await syncFeatureCatalogue();
  await ensureSuperAdmin();
  await purgeDemo();

  // ── Organisation ──
  const org = await createOrganisation({ name: 'Suryodaya Solar Pvt Ltd', slug: DEMO_SLUG, plan: 'growth', features: { amc_contracts: { enabled: true } } });
  await Org.updateOne(
    { _id: org._id },
    {
      $set: {
        'settings.phone': '+91 79 4000 1234',
        'settings.email': 'hello@suryodaya.solar',
        'settings.address': '4th Floor, Sunrise Business Park, SG Highway, Ahmedabad, Gujarat 380054',
        'settings.gstin': '24AAKCS1234H1Z9',
        'settings.googleReviewUrl': 'https://g.page/r/suryodaya-solar/review',
      },
    },
  );

  // ── Users: one per default role ──
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);
  const userIds: Record<string, string> = {};
  for (const role of DEFAULT_ROLES) {
    const u = await User.create({
      orgId: org._id,
      name: USER_NAMES[role.key] ?? role.name,
      email: `${role.key}@${DEMO_DOMAIN}`,
      phone: `+91 98${String(10000000 + Object.keys(userIds).length * 1111111).slice(0, 8)}`,
      passwordHash,
      roleKey: role.key,
    });
    userIds[role.key] = String(u._id);
  }
  const ctx: Record<string, Ctx> = {};
  for (const [k, id] of Object.entries(userIds)) ctx[k] = (await contextForUserId(id)) as Ctx;
  const owner = ctx.owner!;

  await Org.updateOne(
    { _id: org._id },
    {
      $set: {
        partners: [
          { name: USER_NAMES.owner, sharePercent: 40, userId: oid(userIds.owner!) },
          { name: 'Deepak Patel', sharePercent: 30 },
          { name: 'Sunita Rao', sharePercent: 30 },
        ],
      },
    },
  );

  // ── Inventory ──
  const itemDefs = [
    { sku: 'WAA-540', name: 'Waaree Bi-55 540Wp Mono PERC Module', category: 'module', brand: 'Waaree', unit: 'nos', cost: 7600, sell: 9500, reorder: 40, qty: 260, gst: 12 },
    { sku: 'ADA-545', name: 'Adani Shine 545Wp Mono PERC Module (DCR)', category: 'module', brand: 'Adani', unit: 'nos', cost: 9200, sell: 11500, reorder: 40, qty: 180, gst: 12 },
    { sku: 'INV-GW5', name: 'GoodWe 5kW On-grid Inverter', category: 'inverter', brand: 'GoodWe', unit: 'nos', cost: 32000, sell: 40000, reorder: 3, qty: 12, gst: 12 },
    { sku: 'INV-GW3', name: 'GoodWe 3kW On-grid Inverter', category: 'inverter', brand: 'GoodWe', unit: 'nos', cost: 24000, sell: 30000, reorder: 3, qty: 8, gst: 12 },
    { sku: 'INV-SG25', name: 'Sungrow 25kW Three-phase Inverter', category: 'inverter', brand: 'Sungrow', unit: 'nos', cost: 110000, sell: 135000, reorder: 1, qty: 3, gst: 12 },
    { sku: 'STR-GI-1K', name: 'GI Mounting Structure (per kW)', category: 'structure', brand: 'Local', unit: 'kW', cost: 3500, sell: 4500, reorder: 20, qty: 120, gst: 18 },
    { sku: 'CAB-DC4', name: 'DC Solar Cable 4 sq.mm (Polycab)', category: 'cable', brand: 'Polycab', unit: 'm', cost: 48, sell: 65, reorder: 300, qty: 2500, gst: 18 },
    { sku: 'CAB-AC6', name: 'AC Cable 6 sq.mm 4-core', category: 'cable', brand: 'Havells', unit: 'm', cost: 165, sell: 210, reorder: 100, qty: 800, gst: 18 },
    { sku: 'ACDB-1P', name: 'ACDB Single Phase with SPD', category: 'bos', brand: 'Elmex', unit: 'nos', cost: 2600, sell: 3400, reorder: 5, qty: 18, gst: 18 },
    { sku: 'DCDB-2S', name: 'DCDB 2-String with SPD & Fuse', category: 'bos', brand: 'Elmex', unit: 'nos', cost: 3100, sell: 4000, reorder: 5, qty: 16, gst: 18 },
    { sku: 'EAR-KIT', name: 'Chemical Earthing Kit (3 pits)', category: 'earthing', brand: 'JMV', unit: 'set', cost: 5400, sell: 7000, reorder: 5, qty: 14, gst: 18 },
    { sku: 'LA-ESE', name: 'Lightning Arrestor ESE Type', category: 'earthing', brand: 'JMV', unit: 'nos', cost: 6800, sell: 8500, reorder: 5, qty: 6, gst: 18 },
    { sku: 'NM-BIDIR', name: 'Bi-directional Net Meter (Secure)', category: 'meter', brand: 'Secure', unit: 'nos', cost: 7200, sell: 9000, reorder: 4, qty: 5, gst: 18 },
    { sku: 'MC4-PAIR', name: 'MC4 Connector Pair', category: 'bos', brand: 'Stäubli', unit: 'pair', cost: 120, sell: 180, reorder: 50, qty: 400, gst: 18 },
    { sku: 'BAT-LI5', name: 'Lithium Battery 5kWh (Hybrid)', category: 'battery', brand: 'Luminous', unit: 'nos', cost: 145000, sell: 175000, reorder: 1, qty: 1, gst: 18 },
  ] as const;
  const items: Record<string, string> = {};
  for (const d of itemDefs) {
    const it = await createItem(ctx.warehouse!, {
      sku: d.sku,
      name: d.name,
      category: d.category,
      brand: d.brand,
      unit: d.unit,
      costPrice: 0,
      sellPrice: d.sell,
      reorderLevel: d.reorder,
      gstPercent: d.gst,
    });
    items[d.sku] = String(it._id);
    // two purchase lots at slightly different prices → weighted-average cost
    const first = Math.ceil(d.qty * 0.6);
    await applyMovement(ctx.warehouse!, { itemId: items[d.sku]!, type: 'in', quantity: first, unitCost: d.cost * 0.97, reference: `PO-${d.sku}-A`, note: 'Opening stock' });
    await applyMovement(ctx.warehouse!, { itemId: items[d.sku]!, type: 'in', quantity: d.qty - first, unitCost: d.cost * 1.03, reference: `PO-${d.sku}-B`, note: 'Purchase' });
  }

  // ── Helpers ──
  async function addDoc(projectId: string, type: string, stageKey?: string) {
    const isPhoto = PHOTO_TYPES.has(type);
    await storeDocument(owner, { originalname: `${type}.${isPhoto ? 'png' : 'pdf'}`, mimetype: isPhoto ? 'image/png' : 'application/pdf', size: isPhoto ? PNG.length : 120, buffer: isPhoto ? PNG : pdf(type) }, {
      projectId,
      type: type as never,
      stageKey,
      note: 'Demo placeholder',
    });
  }

  async function pay(projectId: string, amount: number, mode: PaymentMode, type: 'advance' | 'milestone' | 'final' | 'subsidy' | 'loan', when: Date, reference?: string) {
    await createPayment(ctx.accounts!, { projectId, amount, mode, type, receivedAt: when, reference });
  }

  function boqFor(kw: number, module: 'WAA-540' | 'ADA-545') {
    const modules = Math.ceil((kw * 1000) / (module === 'WAA-540' ? 540 : 545));
    const inverter = kw >= 20 ? 'INV-SG25' : kw > 4 ? 'INV-GW5' : 'INV-GW3';
    const cost = (sku: string) => itemDefs.find((i) => i.sku === sku)!.cost;
    const line = (sku: string, qty: number, description: string, unit = 'nos') => ({ itemId: items[sku], description, quantity: qty, unit, unitCost: cost(sku) });
    return [
      line(module, modules, 'Solar PV modules', 'nos'),
      line(inverter, 1, 'On-grid inverter'),
      line('STR-GI-1K', Math.ceil(kw), 'Mounting structure', 'kW'),
      line('CAB-DC4', Math.round(kw * 20), 'DC cable', 'm'),
      line('CAB-AC6', Math.round(kw * 6), 'AC cable', 'm'),
      line('ACDB-1P', 1, 'ACDB'),
      line('DCDB-2S', 1, 'DCDB'),
      line('EAR-KIT', 1, 'Earthing kit', 'set'),
      line('LA-ESE', 1, 'Lightning arrestor'),
      line('MC4-PAIR', Math.ceil(modules / 2), 'MC4 connectors', 'pair'),
    ];
  }

  interface Plan {
    id: string;
    kw: number;
    cv: number;
    module: 'WAA-540' | 'ADA-545';
    start: Date;
  }

  function stageData(key: string, p: Plan, i: number): Record<string, unknown> {
    const at = (offset: number) => isoDay(new Date(p.start.getTime() + offset * DAY));
    switch (key) {
      case 'quotation_sent':
        return { monthlyUnits: Math.round(p.kw * 120), proposedKw: p.kw, quotedAmount: Math.round(p.cv * 1.05) };
      case 'site_survey':
        return { surveyDate: at(2), roofType: i % 3 === 0 ? 'metal_sheet' : 'rcc', floors: 1 + (i % 3), shadowFreeAreaSqft: Math.round(p.kw * 100), sanctionedLoadKw: Math.ceil(p.kw) + 1, structureHeightFt: 6, notes: 'South-facing roof, minimal shading after 4pm.' };
      case 'final_quotation':
        return { finalKw: p.kw, contractValue: p.cv, orderDate: at(5) };
      case 'documents_collection':
        return { consumerNumber: `UGVCL-${31000000 + i * 7331}` };
      case 'subsidy_loan':
        return { subsidyApplicationNo: `PMSG-GJ-${2026}${String(4500 + i)}`, subsidyAmount: p.kw >= 3 ? 78000 : 60000, loanRequired: i % 4 === 1, loanBank: i % 4 === 1 ? 'State Bank of India' : undefined, loanAmount: i % 4 === 1 ? Math.round(p.cv * 0.5) : undefined };
      case 'material_check':
        return { shortages: '' };
      case 'dispatch_planning':
        return { dispatchDate: at(14), vehicleNo: `GJ01AB${1200 + i}`, driverPhone: '+91 9825012345' };
      case 'material_unloading':
        return { unloadedAt: at(15) };
      case 'engineer_allocation':
        return { engineerId: userIds.engineer };
      case 'installation_schedule':
        return { installationDate: at(16), crewSize: p.kw > 10 ? 6 : 4 };
      case 'installation':
        return { completedOn: at(17), inverterSerial: `GW${50000 + i * 17}`, moduleSerials: `WS${900000 + i * 40}–WS${900000 + i * 40 + 12}` };
      case 'project_documents':
        return { invoiceNo: `INV/26-27/${String(100 + i)}` };
      case 'net_metering_submission':
        return { netMeteringAppNo: `NM-UGVCL-${7700 + i}`, submittedOn: at(20) };
      case 'ae_inspection_followup':
        return { inspectionDate: at(26) };
      case 'inspection_done':
        return { inspectedBy: 'Shri R. K. Parmar (AE)' };
      case 'meter_fixing':
        return { meterNumber: `SEC${8800000 + i * 13}`, meterInstalledOn: at(32) };
      case 'client_training':
        return { monitoringAppId: `SEMS-${40000 + i}` };
      case 'review_request':
        return { rating: 5 };
      default:
        return {};
    }
  }

  const keys = DEFAULT_STAGES.map((s) => s.key);

  /** Complete every stage before `until` (exclusive) through the engine, preparing prerequisites. */
  async function advance(p: Plan, i: number, until: string | null, opts: { skipReview?: boolean; extra?: string[]; data?: Record<string, Record<string, unknown>> } = {}) {
    const stop = until ? keys.indexOf(until) : keys.length;
    for (const key of [...keys.slice(0, stop), ...(opts.extra ?? [])]) await completeKey(p, i, key, opts);
  }

  /** Prepare a stage's prerequisites (docs, BOQ, payments, dispatch, expenses) and complete it. */
  async function completeKey(p: Plan, i: number, key: string, opts: { skipReview?: boolean; data?: Record<string, Record<string, unknown>> }) {
    const def = DEFAULT_STAGES.find((d) => d.key === key)!;
    const project = await Project.findById(p.id).lean();
    const state = project!.stages.find((s) => s.key === key)!;
    if (state.status === 'completed' || state.status === 'skipped') return;

    for (const t of def.requiredDocuments) await addDoc(p.id, t, key);
    if (key === 'boq_preparation') await setBoq(owner, p.id, { items: boqFor(p.kw, p.module) as never });
    if (key === 'advance_payment') await pay(p.id, Math.round(p.cv * 0.35), i % 2 ? 'phonepe' : 'company_account', 'advance', new Date(p.start.getTime() + 7 * DAY), `UTR${880000 + i}`);
    if (key === 'material_unloading') {
      const d = await Dispatch.findOne({ projectId: p.id }).lean();
      if (d) for (const s of ['in_transit', 'delivered', 'unloaded'] as const) await setDispatchStatus(ctx.warehouse!, String(d._id), s);
    }
    if (key === 'expenses_bills') {
      const at = (days: number) => new Date(p.start.getTime() + days * DAY);
      const e1 = await createExpense(ctx.engineer!, { projectId: p.id, category: 'labour', amount: Math.round(p.kw * 1500), description: 'Installation crew wages', incurredAt: at(17), paidBy: 'company' });
      await decideExpense(ctx.accounts!, String((e1 as any)._id), { status: 'approved' });
      const e2 = await createExpense(ctx.engineer!, { projectId: p.id, category: 'local_bos', amount: Math.round(p.kw * 420), description: 'Local BOS: conduits, lugs, cable ties', vendor: 'Shree Electricals', incurredAt: at(16), paidBy: 'employee' });
      await decideExpense(ctx.accounts!, String((e2 as any)._id), { status: 'approved' });
      await createExpense(ctx.accounts!, { projectId: p.id, category: 'transport', amount: 3500, description: 'Tempo hire warehouse → site', incurredAt: at(14), paidBy: 'company' });
    }
    if (key === 'project_closure') {
      const received = (await mongoose.model('Payment').aggregate([{ $match: { projectId: oid(p.id), deletedAt: null } }, { $group: { _id: null, t: { $sum: '$amount' } } }]))[0]?.t ?? 0;
      const due = p.cv - received;
      const subsidy = Math.min(78000, Math.round(due * 0.4));
      await pay(p.id, subsidy, 'subsidy_credit', 'subsidy', new Date(p.start.getTime() + 36 * DAY), 'PM Surya Ghar DBT');
      await pay(p.id, due - subsidy, i % 2 ? 'bank_transfer' : 'cheque', 'final', new Date(p.start.getTime() + 38 * DAY), `CHQ${445500 + i}`);
    }

    const input: StageUpdateInput =
      key === 'review_request' && opts.skipReview
        ? { status: 'skipped', note: 'Customer prefers not to post reviews' }
        : { status: 'completed', checklist: state.checklist.map((c) => ({ label: c.label, done: true })), data: { ...stageData(key, p, i), ...(opts.data?.[key] ?? {}) } };
    // Use a user of the stage's owner role when that user can see the project.
    const roleCtx = def.ownerRoles.map((r) => ctx[r]).find(Boolean) ?? owner;
    try {
      await updateStage(roleCtx, p.id, key, input);
    } catch (err) {
      if ((err as { code?: string }).code !== 'NOT_FOUND') throw err;
      await updateStage(owner, p.id, key, input);
    }
  }

  // ── Leads ──
  const leadSeeds = [
    { name: 'Rajesh Shah', phone: '+91 98250 11223', city: 'Ahmedabad', source: 'referral', kw: 5, bill: 4200 },
    { name: 'Patel Textiles LLP', phone: '+91 98790 44556', city: 'Surat', source: 'campaign', kw: 25, bill: 38000, type: 'commercial' },
    { name: 'Anita Deshmukh', phone: '+91 99099 22334', city: 'Vadodara', source: 'website', kw: 4, bill: 3100 },
    { name: 'Harish Trivedi', phone: '+91 97234 55667', city: 'Gandhinagar', source: 'social_media', kw: 6, bill: 5200 },
    { name: 'Kavita Nair', phone: '+91 98980 77889', city: 'Ahmedabad', source: 'walk_in', kw: 3, bill: 2600 },
    { name: 'Sanjay Kulkarni', phone: '+91 90990 12121', city: 'Anand', source: 'phone', kw: 5, bill: 4500 },
    { name: 'Green Valley School', phone: '+91 79260 34343', city: 'Ahmedabad', source: 'partner', kw: 15, bill: 21000, type: 'commercial' },
    { name: 'Mohan Lal Farms', phone: '+91 94260 56565', city: 'Mehsana', source: 'referral', kw: 10, bill: 9000, type: 'agricultural' },
    { name: 'Ritu Agarwal', phone: '+91 98251 78787', city: 'Rajkot', source: 'website', kw: 3, bill: 2400 },
    { name: 'Dinesh Chauhan', phone: '+91 97129 90909', city: 'Bhavnagar', source: 'campaign', kw: 7, bill: 6100 },
    { name: 'Fatima Sheikh', phone: '+91 93270 13579', city: 'Ahmedabad', source: 'social_media', kw: 4, bill: 3300 },
    { name: 'Om Sai Hospital', phone: '+91 79400 24680', city: 'Nadiad', source: 'phone', kw: 20, bill: 32000, type: 'commercial' },
  ] as const;
  const leadIds: string[] = [];
  for (const [i, l] of leadSeeds.entries()) {
    const lead = await createLead(i % 3 === 2 ? ctx.manager! : ctx.sales!, {
      name: l.name,
      phone: l.phone,
      email: `${l.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@example.in`,
      address: { line1: `${12 + i}, ${['Shivranjani Society', 'Ring Road', 'Station Road', 'Nehru Nagar'][i % 4]}`, city: l.city, district: l.city, state: 'Gujarat', pincode: `3800${String(10 + i).padStart(2, '0')}` },
      customerType: ('type' in l ? l.type : 'residential') as never,
      source: l.source as never,
      status: 'new',
      monthlyBill: l.bill,
      requiredKw: l.kw,
      assignedTo: userIds.sales,
      followUpAt: new Date(Date.now() + ((i % 5) + 1) * DAY),
      notes: '',
    });
    const id = String((lead as any)._id);
    leadIds.push(id);
    await addActivity(ctx.sales!, id, { type: 'call', note: `Discussed rooftop solar for ~${l.kw} kW; monthly bill ₹${l.bill}.` });
    await Lead.collection.updateOne({ _id: oid(id) }, { $set: { createdAt: daysAgo(70 - i * 5) } });
  }
  const leadStatus: Record<number, { status: string; lostReason?: string }> = {
    5: { status: 'contacted' },
    6: { status: 'survey_scheduled' },
    7: { status: 'negotiation' },
    8: { status: 'new' },
    9: { status: 'lost', lostReason: 'Went with a cheaper local installer' },
    10: { status: 'new' },
    11: { status: 'negotiation' },
  };
  for (const [idx, s] of Object.entries(leadStatus)) await Lead.updateOne({ _id: leadIds[Number(idx)] }, { $set: s });
  // initial quotations for two open leads
  for (const idx of [7, 11]) {
    const l = leadSeeds[idx]!;
    const q = await createQuotation(ctx.sales!, {
      leadId: leadIds[idx]!,
      kind: 'initial',
      systemSizeKw: l.kw,
      lines: [
        { description: `${l.kw} kW on-grid solar system (modules, inverter, structure, BOS)`, quantity: 1, unitPrice: l.kw * 52000, gstPercent: 12 },
        { description: 'Installation, commissioning & net-metering liaison', quantity: 1, unitPrice: l.kw * 4000, gstPercent: 18 },
      ],
      discount: 0,
      terms: '40% advance, 50% on material delivery, 10% after commissioning.',
    });
    await setQuotationStatus(ctx.sales!, String((q as any)._id), 'sent');
  }

  // ── Projects ──
  const plans: { lead?: number; customer?: { name: string; phone: string; email: string; city: string }; kw: number; cv: number; module: 'WAA-540' | 'ADA-545'; startDaysAgo: number; until: string | null; type?: string; skipReview?: boolean; extra?: string[]; data?: Record<string, Record<string, unknown>> }[] = [
    { lead: 0, kw: 5, cv: 285000, module: 'ADA-545', startDaysAgo: 150, until: null },
    { lead: 1, kw: 25, cv: 1150000, module: 'WAA-540', startDaysAgo: 120, until: null, type: 'commercial', skipReview: true },
    { lead: 2, kw: 4, cv: 236000, module: 'ADA-545', startDaysAgo: 60, until: 'meter_fixing' },
    { lead: 3, kw: 6, cv: 342000, module: 'ADA-545', startDaysAgo: 40, until: 'site_photos' },
    { lead: 4, kw: 3, cv: 186000, module: 'WAA-540', startDaysAgo: 25, until: 'material_unloading', extra: ['engineer_allocation', 'installation_schedule'], data: { installation_schedule: { installationDate: isoDay(new Date(Date.now() + 3 * DAY)) } } },
    { customer: { name: 'Bhavesh Solanki', phone: '+91 98795 31313', email: 'bhavesh.solanki@example.in', city: 'Ahmedabad' }, kw: 5, cv: 290000, module: 'ADA-545', startDaysAgo: 15, until: 'documents_collection' },
    { customer: { name: 'Nirmala Joshi', phone: '+91 97140 64646', email: 'nirmala.joshi@example.in', city: 'Vadodara' }, kw: 3, cv: 180000, module: 'WAA-540', startDaysAgo: 8, until: 'site_survey' },
    { customer: { name: 'Shree Ganesh Traders', phone: '+91 99250 97979', email: 'accounts@ganeshtraders.example.in', city: 'Surat' }, kw: 10, cv: 520000, module: 'WAA-540', startDaysAgo: 3, until: 'quotation_sent', type: 'commercial' },
  ];

  const projectIds: string[] = [];
  for (const [i, pl] of plans.entries()) {
    let project: any;
    if (pl.lead !== undefined) {
      project = await convertLead(ctx.sales!, leadIds[pl.lead]!, { systemSizeKw: pl.kw });
    } else {
      const c = pl.customer!;
      project = await createProject(ctx.sales!, {
        customer: { name: c.name, phone: c.phone, email: c.email, address: { line1: 'Near City Mall', city: c.city, district: c.city, state: 'Gujarat', pincode: '380015' } },
        customerType: (pl.type ?? 'residential') as never,
        connectionType: 'on_grid',
        systemSizeKw: pl.kw,
        contractValue: 0,
      });
    }
    const id = String(project._id);
    projectIds.push(id);
    await Project.updateOne({ _id: id }, { $set: { 'team.manager': oid(userIds.manager!), 'team.operations': oid(userIds.operations!) } });
    const plan: Plan = { id, kw: pl.kw, cv: pl.cv, module: pl.module, start: daysAgo(pl.startDaysAgo) };

    // final quotation document trail for projects past the sales phase
    if (pl.until === null || keys.indexOf(pl.until) > keys.indexOf('final_quotation')) {
      const q = await createQuotation(ctx.sales!, {
        projectId: id,
        kind: 'final',
        systemSizeKw: pl.kw,
        lines: [
          { description: `${pl.kw} kW on-grid solar system — ${pl.module === 'ADA-545' ? 'Adani 545Wp DCR' : 'Waaree 540Wp'} modules`, quantity: 1, unitPrice: Math.round((pl.cv / 1.12) * 0.9), gstPercent: 12 },
          { description: 'Installation & commissioning', quantity: 1, unitPrice: Math.round((pl.cv * 0.1) / 1.18), gstPercent: 18 },
        ],
        discount: 0,
      });
      await setQuotationStatus(ctx.sales!, String((q as any)._id), 'sent');
      await setQuotationStatus(ctx.manager!, String((q as any)._id), 'accepted');
    }

    await advance(plan, i, pl.until, { skipReview: pl.skipReview, extra: pl.extra, data: pl.data });
    if (pl.until) {
      // Show the next stage as being worked on.
      const p = await Project.findById(id).lean();
      const next = p!.stages.find((s) => s.key === pl.until);
      if (next?.status === 'pending') {
        const def = DEFAULT_STAGES.find((d) => d.key === pl.until)!;
        const who = def.ownerRoles.map((r) => ctx[r]).find(Boolean) ?? owner;
        await updateStage(who, id, pl.until, { status: 'in_progress', note: 'Started — following up with the customer.' }).catch(() => updateStage(owner, id, pl.until!, { status: 'in_progress' }));
      }
    }
    await Project.collection.updateOne({ _id: oid(id) }, { $set: { createdAt: plan.start } });
  }

  // Partial advance on the documentation-phase project (advance gate not yet met).
  await pay(projectIds[5]!, 29000, 'upi', 'advance', daysAgo(10), 'UPI/4455667788');
  for (const t of ['aadhaar', 'pan']) await addDoc(projectIds[5]!, t, 'documents_collection');
  // Dispatch for project 5 in transit (material_unloading in progress).
  const d5 = await Dispatch.findOne({ projectId: projectIds[4] }).lean();
  if (d5 && d5.status === 'planned') await setDispatchStatus(ctx.warehouse!, String(d5._id), 'in_transit', 'Left warehouse 9:30am');
  // Some overdue work for the dashboard: pretend these stages became available a while ago.
  await Project.collection.updateOne({ _id: oid(projectIds[5]!), 'stages.key': 'advance_payment' }, { $set: { 'stages.$.dueAt': daysAgo(2) } });
  await Project.collection.updateOne({ _id: oid(projectIds[6]!), 'stages.key': 'site_survey' }, { $set: { 'stages.$.dueAt': daysAgo(1) } });
  // A blocked stage for realism.
  await updateStage(ctx.sales!, projectIds[6]!, 'site_survey', { status: 'blocked', blockedReason: 'Customer travelling until next week' });

  // ── Customer portal user linked to the net-metering project ──
  await Project.updateOne({ _id: projectIds[2] }, { $set: { customerUserId: oid(userIds.customer!), 'customer.email': `customer@${DEMO_DOMAIN}`, 'customer.name': USER_NAMES.customer } });

  // ── Office expenses & advances ──
  for (const [n, e] of [
    { category: 'office', amount: 35000, description: 'Office rent — SG Highway', months: 0 },
    { category: 'office', amount: 35000, description: 'Office rent — SG Highway', months: 1 },
    { category: 'salary', amount: 145000, description: 'Staff salaries', months: 1 },
    { category: 'fees_permits', amount: 6500, description: 'DISCOM net-metering fees (batch)', months: 0 },
    { category: 'tools', amount: 12800, description: 'Crimping tools & torque wrench', months: 2 },
  ].entries()) {
    await createExpense(owner, { category: e.category as never, amount: e.amount, description: e.description, incurredAt: daysAgo(e.months * 30 + n + 2), paidBy: 'company' });
  }
  await createExpense(ctx.engineer!, { projectId: projectIds[3]!, category: 'food_travel', amount: 1850, description: 'Crew lunch & fuel', incurredAt: daysAgo(3), paidBy: 'employee' });

  await createAdvance(owner, { personName: 'Deepak Patel', kind: 'partner', amount: 50000, takenAt: daysAgo(40), note: 'Personal advance against profit' });
  await createAdvance(owner, { personName: 'Sunita Rao', kind: 'partner', amount: 25000, takenAt: daysAgo(20) });
  await createAdvance(owner, { personName: USER_NAMES.engineer!, userId: userIds.engineer, kind: 'employee', amount: 8000, takenAt: daysAgo(12), note: 'Site travel float' });
  const settled = await createAdvance(owner, { personName: USER_NAMES.warehouse!, userId: userIds.warehouse, kind: 'employee', amount: 5000, takenAt: daysAgo(50) });
  await settleAdvance(owner, String(settled._id));

  // ── Service tickets & AMC ──
  const t1 = await createTicket(ctx.service!, { projectId: projectIds[0]!, subject: 'Generation lower than expected', description: 'Customer reports ~15% lower units this month.', category: 'low_generation', priority: 'medium' });
  await updateTicket(ctx.manager!, String((t1 as any)._id), { assigneeId: userIds.service });
  await addTicketComment(ctx.service!, String((t1 as any)._id), 'Panels were dusty; cleaning done and generation normalised.');
  await updateTicket(ctx.service!, String((t1 as any)._id), { status: 'resolved', resolution: 'Module cleaning; advised fortnightly cleaning cycle.' });
  const t2 = await createTicket(ctx.manager!, { projectId: projectIds[1]!, subject: 'Inverter shows grid overvoltage error', description: 'Sungrow inverter tripping around noon with overvoltage fault.', category: 'inverter_error', priority: 'high' });
  await updateTicket(ctx.manager!, String((t2 as any)._id), { assigneeId: userIds.service, status: 'in_progress' });
  const custCtx = (await contextForUserId(userIds.customer!)) as Ctx;
  await createTicket(custCtx, { projectId: projectIds[2]!, subject: 'Monitoring app not showing data', description: 'The app shows offline since yesterday.', category: 'app_monitoring', priority: 'low' });

  const amc = await createAmc(owner, { projectId: projectIds[0]!, startDate: daysAgo(100), endDate: new Date(Date.now() + 265 * DAY), visitsPerYear: 4, amount: 6000, notes: 'Quarterly cleaning & health check' });
  await updateVisit(ctx.service!, String((amc as any)._id), String((amc as any).visits[0]._id), { done: true, note: 'Cleaned 10 modules, checked earthing.' });

  // ── Summary ──
  const counts = await Promise.all([Project.countDocuments({ orgId: org._id }), Lead.countDocuments({ orgId: org._id }), mongoose.model('Payment').countDocuments({ orgId: org._id })]);
  logger.info({ projects: counts[0], leads: counts[1], payments: counts[2] }, 'Demo data created');

  const rows = DEFAULT_ROLES.map((r) => ({ role: r.name, email: `${r.key}@${DEMO_DOMAIN}`, password: DEMO_PASSWORD }));
  if (env.SUPER_ADMIN_EMAIL) rows.push({ role: 'Platform super admin', email: env.SUPER_ADMIN_EMAIL, password: '(SUPER_ADMIN_PASSWORD from env)' });
  const w = [Math.max(...rows.map((r) => r.role.length)), Math.max(...rows.map((r) => r.email.length)), Math.max(...rows.map((r) => r.password.length))];
  const line = `+${w.map((n) => '-'.repeat(n + 2)).join('+')}+`;
  const fmt = (a: string[]) => `| ${a.map((s, i) => s.padEnd(w[i]!)).join(' | ')} |`;
  console.log(`\nSolarFlow demo — ${org.name} (slug: ${DEMO_SLUG})`);
  console.log(line);
  console.log(fmt(['Role', 'Email', 'Password']));
  console.log(line);
  for (const r of rows) console.log(fmt([r.role, r.email, r.password]));
  console.log(line);
  console.log(`Customer portal user is linked to project ${(await Project.findById(projectIds[2]).lean())!.code}.\n`);
}

main()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Seed failed');
    console.error(err);
    await disconnectDb().catch(() => undefined);
    process.exit(1);
  });
