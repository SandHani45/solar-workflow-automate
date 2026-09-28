/**
 * Workflow engine: applies the stage rules and automations from docs/API.md to a
 * project's stage graph. Pure graph maths lives in @solar/shared (computeStageAvailability,
 * projectProgress, currentPhase); this module adds persistence, authorisation, gating
 * rules, automations, audit and notifications.
 */
import {
  DOCUMENT_TYPE_LABELS,
  computeStageAvailability,
  currentPhase,
  formatINR,
  isFeatureEnabled,
  isStageDone,
  projectProgress,
  roundMoney,
  type FeatureDefinition,
  type OrgFeatureMap,
  type StageDefinition,
  type StageUpdateInput,
} from '@solar/shared';
import { can, isOid, oid, sameId, type Ctx } from '../../lib/context';
import { conflict, notFound, stageRule } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { ObjectId } from '../../lib/mongoose';
import { audit } from '../audit/service';
import { DocumentModel } from '../documents/model';
import { createDispatch } from '../dispatches/service';
import { Dispatch } from '../dispatches/model';
import { projectReceived } from '../finance/calc';
import { Lead } from '../leads/model';
import { notifyUsers } from '../notifications/service';
import { Org, type OrgDoc } from '../org/model';
import { getCatalogue } from '../platform/catalogue';
import { Role } from '../roles/model';
import { User } from '../users/model';
import { projectScope } from './access';
import { Project, type ProjectDoc, type StageState } from './model';

const DAY_MS = 86_400_000;
const PRIVILEGED_ROLES = ['owner', 'admin'];

// ───────────────────────────── graph helpers ─────────────────────────────

export function initialStageStates(defs: StageDefinition[]): StageState[] {
  return defs.map((d) => ({
    key: d.key,
    status: 'locked',
    assignee: null,
    startedAt: null,
    completedAt: null,
    completedBy: null,
    dueAt: null,
    checklist: (d.checklist ?? []).map((label) => ({ label, done: false })),
    data: {},
    notes: [],
    blockedReason: null,
    autoSkipped: false,
  }));
}

/** Copy stage states without structuredClone (which would mangle ObjectId / Date instances). */
export function cloneStages(stages: StageState[]): StageState[] {
  return stages.map((s) => ({
    ...s,
    checklist: (s.checklist ?? []).map((c) => ({ label: c.label, done: c.done })),
    data: { ...(s.data ?? {}) },
    notes: (s.notes ?? []).map((n) => ({ ...n })),
  }));
}

type FeatureCheck = (def: StageDefinition) => boolean;

export function stageDisabledCheck(orgFeatures: OrgFeatureMap | undefined, catalogue: FeatureDefinition[]): FeatureCheck {
  return (def) => def.enabled === false || (!!def.feature && !isFeatureEnabled(def.feature, orgFeatures, undefined, catalogue));
}

/**
 * Rule 5: stages whose feature (or the stage itself) is disabled are auto-skipped. When the
 * feature comes back, auto-skipped stages are restored (to locked, then availability decides).
 */
export function applyDisabledStages(stages: StageState[], defs: StageDefinition[], isDisabled: FeatureCheck): boolean {
  let changed = false;
  for (const s of stages) {
    const def = defs.find((d) => d.key === s.key);
    if (!def) continue;
    const disabled = isDisabled(def);
    if (disabled && !isStageDone(s.status)) {
      s.status = 'skipped';
      s.autoSkipped = true;
      s.dueAt = null;
      changed = true;
    } else if (!disabled && s.autoSkipped && s.status === 'skipped') {
      s.status = 'locked';
      s.autoSkipped = false;
      changed = true;
    }
  }
  return changed;
}

/**
 * Rule 6: recompute availability; stages that just became available get `dueAt = now + slaDays`.
 * Returns the keys of newly available stages.
 */
export function recomputeStages(stages: StageState[], defs: StageDefinition[], now = new Date()): string[] {
  const before = new Map(stages.map((s) => [s.key, s.status]));
  const next = computeStageAvailability(stages, defs);
  const unlocked: string[] = [];
  next.forEach((s, i) => {
    const target = stages[i]!;
    const prev = before.get(s.key);
    target.status = s.status;
    if (prev === 'locked' && s.status === 'pending') {
      const def = defs.find((d) => d.key === s.key);
      target.dueAt = new Date(now.getTime() + (def?.slaDays ?? 0) * DAY_MS);
      unlocked.push(s.key);
    } else if (prev === 'pending' && s.status === 'locked') {
      target.dueAt = null;
    }
  });
  return unlocked;
}

export function derivedFields(stages: StageState[], defs: StageDefinition[]) {
  return { currentPhase: currentPhase(stages, defs), progress: projectProgress(stages) };
}

async function orgAndCatalogue(orgId: ObjectId | string): Promise<{ org: OrgDoc; catalogue: FeatureDefinition[] }> {
  const [org, catalogue] = await Promise.all([Org.findById(orgId).lean(), getCatalogue()]);
  if (!org) throw notFound('Organisation');
  return { org, catalogue };
}

/** Build the initial stage list for a new project from the org workflow snapshot. */
export async function initialiseProjectStages(orgId: ObjectId | string, defs: StageDefinition[]) {
  const { org, catalogue } = await orgAndCatalogue(orgId);
  const stages = initialStageStates(defs);
  applyDisabledStages(stages, defs, stageDisabledCheck(org.features, catalogue));
  const unlocked = recomputeStages(stages, defs);
  return { stages, unlocked, ...derivedFields(stages, defs) };
}

/** Rule 5 "on read": re-apply feature skips to a project and persist if anything changed. */
export async function syncProjectFeatures(project: ProjectDoc, org?: OrgDoc): Promise<ProjectDoc> {
  if (project.status !== 'active' && project.status !== 'on_hold') return project;
  const [o, catalogue] = await Promise.all([org ? Promise.resolve(org) : Org.findById(project.orgId).lean(), getCatalogue()]);
  if (!o) return project;
  const stages = cloneStages(project.stages);
  const changed = applyDisabledStages(stages, project.stageDefinitions, stageDisabledCheck(o.features, catalogue));
  if (!changed) return project;
  const unlocked = recomputeStages(stages, project.stageDefinitions);
  const derived = derivedFields(stages, project.stageDefinitions);
  const updated = await Project.findOneAndUpdate({ _id: project._id, orgId: project.orgId }, { $set: { stages, ...derived } }, { returnDocument: 'after' }).lean();
  if (unlocked.length && updated) await notifyStageOwners(updated, unlocked, null);
  return updated ?? project;
}

/** Called whenever org / platform feature flags change. */
export async function syncOrgProjectsForFeatures(orgId: ObjectId | string): Promise<number> {
  const org = await Org.findById(orgId).lean();
  if (!org) return 0;
  const projects = await Project.find({ orgId: org._id, deletedAt: null, status: { $in: ['active', 'on_hold'] } }).lean();
  let n = 0;
  for (const p of projects) {
    const after = await syncProjectFeatures(p, org);
    if (after !== p) n++;
  }
  return n;
}

// ───────────────────────────── notifications ─────────────────────────────

/** Rule 7: notify users who own newly available stages (and can see the project) + assignees. */
export async function notifyStageOwners(project: ProjectDoc, stageKeys: string[], actorId: string | null): Promise<void> {
  try {
    const defs = project.stageDefinitions.filter((d) => stageKeys.includes(d.key));
    if (!defs.length) return;
    const roleKeys = [...new Set(defs.flatMap((d) => d.ownerRoles))];
    const [users, readAllRoles] = await Promise.all([
      User.find({ orgId: project.orgId, roleKey: { $in: roleKeys }, isActive: true, invitePending: false }).select('_id roleKey').lean(),
      Role.find({ orgId: project.orgId, permissions: 'projects:read_all' }).select('key').lean(),
    ]);
    const readAll = new Set(['owner', ...readAllRoles.map((r) => r.key)]);
    const teamIds = new Set(Object.values(project.team ?? {}).filter(Boolean).map(String));
    for (const def of defs) {
      const recipients = users
        .filter((u) => def.ownerRoles.includes(u.roleKey) && (readAll.has(u.roleKey) || teamIds.has(String(u._id))))
        .map((u) => String(u._id));
      const assignee = project.stages.find((s) => s.key === def.key)?.assignee;
      if (assignee) recipients.push(String(assignee));
      await notifyUsers(
        project.orgId,
        recipients,
        { title: `${def.name} is ready`, body: `${project.code} · ${project.customer.name}: stage "${def.name}" is now available.`, link: `/projects/${project._id}?stage=${def.key}` },
        actorId ?? undefined,
      );
    }
  } catch (err) {
    logger.warn({ err }, 'stage notification failed');
  }
}

// ───────────────────────────── rule checks ─────────────────────────────

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const stageName = (defs: StageDefinition[], key: string) => defs.find((d) => d.key === key)?.name ?? key;

/** Coerce number/boolean fields sent as strings (forms) into proper types. */
function coerceData(def: StageDefinition, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const f of def.fields ?? []) {
    const v = out[f.key];
    if (v === undefined || v === null || v === '') continue;
    if ((f.type === 'number' || f.type === 'currency') && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) out[f.key] = Number(v);
    if (f.type === 'boolean' && typeof v === 'string') out[f.key] = v === 'true';
  }
  return out;
}

async function completionReasons(project: ProjectDoc, def: StageDefinition, state: StageState, org: OrgDoc): Promise<string[]> {
  const reasons: string[] = [];

  if (def.requiredDocuments?.length) {
    const present: string[] = await DocumentModel.distinct('type', { orgId: project.orgId, projectId: project._id, type: { $in: def.requiredDocuments } });
    const missing = def.requiredDocuments.filter((t) => !present.includes(t));
    if (missing.length) reasons.push(`Upload required documents: ${missing.map((t) => DOCUMENT_TYPE_LABELS[t] ?? t).join(', ')}`);
  }

  const openItems = state.checklist.filter((c) => !c.done).map((c) => c.label);
  if (openItems.length) reasons.push(`Complete the checklist: ${openItems.join('; ')}`);

  const missingFields = (def.fields ?? []).filter((f) => f.required && isBlank(state.data?.[f.key])).map((f) => f.label);
  if (missingFields.length) reasons.push(`Fill in required fields: ${missingFields.join(', ')}`);

  for (const f of def.fields ?? []) {
    const v = state.data?.[f.key];
    if (isBlank(v)) continue;
    if ((f.type === 'number' || f.type === 'currency') && (typeof v !== 'number' || !Number.isFinite(v))) reasons.push(`${f.label} must be a number`);
    if (f.type === 'date' && Number.isNaN(new Date(String(v)).getTime())) reasons.push(`${f.label} must be a valid date`);
    if (f.type === 'select' && f.options?.length && !f.options.includes(String(v))) reasons.push(`${f.label} must be one of: ${f.options.join(', ')}`);
    if (f.type === 'user') {
      const u = isOid(v) ? await User.findOne({ _id: v, orgId: project.orgId, isActive: true }).select('roleKey').lean() : null;
      if (!u) reasons.push(`${f.label} must be an active user in your organisation`);
      else if (f.roleFilter?.length && !f.roleFilter.includes(u.roleKey)) reasons.push(`${f.label} must have role: ${f.roleFilter.join(', ')}`);
    }
  }

  if (def.requiresAdvancePayment || def.requiresFullPayment) {
    const received = await projectReceived(project.orgId, project._id);
    const contract = project.contractValue ?? 0;
    if (contract <= 0) {
      reasons.push('Contract value is not set on the project (complete the final quotation first)');
    } else {
      if (def.requiresAdvancePayment) {
        const pct = org.settings?.advancePercent ?? 30;
        const needed = roundMoney((contract * pct) / 100);
        if (received + 0.005 < needed) reasons.push(`Advance of ${pct}% (${formatINR(needed)}) required; received ${formatINR(received)}`);
      }
      if (def.requiresFullPayment && received + 0.005 < contract) {
        reasons.push(`Full payment required: received ${formatINR(received)} of ${formatINR(contract)} (pending ${formatINR(roundMoney(contract - received))})`);
      }
    }
  }
  return reasons;
}

// ───────────────────────────── automations ─────────────────────────────

const toDate = (v: unknown): Date | undefined => {
  if (isBlank(v)) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const toNum = (v: unknown): number | undefined => (isBlank(v) || !Number.isFinite(Number(v)) ? undefined : Number(v));
const toStr = (v: unknown): string | undefined => (isBlank(v) ? undefined : String(v));

/**
 * Rule 6 automations. Returns a `$set` patch for the project plus side-effect descriptions.
 * Stage-key based copies (final_quotation, site_survey, …) are applied alongside the
 * declared `automations` so renamed/custom workflows keep working.
 */
async function runAutomations(ctx: Ctx, project: ProjectDoc, def: StageDefinition, data: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  const effects: string[] = [];
  const autos = new Set(def.automations ?? []);

  // Field copies by stage key.
  if (def.key === 'final_quotation') {
    const kw = toNum(data.finalKw);
    const cv = toNum(data.contractValue);
    if (kw !== undefined) set.systemSizeKw = kw;
    if (cv !== undefined) set.contractValue = roundMoney(cv);
    if (kw !== undefined || cv !== undefined) effects.push('Copied final size / contract value to project');
  }
  if (def.key === 'site_survey') {
    set.survey = {
      roofType: toStr(data.roofType),
      floors: toNum(data.floors),
      shadowFreeAreaSqft: toNum(data.shadowFreeAreaSqft),
      sanctionedLoadKw: toNum(data.sanctionedLoadKw),
      surveyDate: toDate(data.surveyDate),
      notes: toStr(data.notes),
    };
    effects.push('Saved survey details');
  }
  if (def.key === 'documents_collection' && toStr(data.consumerNumber)) set['customer.consumerNumber'] = toStr(data.consumerNumber);
  if (def.key === 'ae_inspection_followup' && toDate(data.inspectionDate)) {
    set['netMetering.status'] = 'inspection_scheduled';
    set['netMetering.inspectionDate'] = toDate(data.inspectionDate);
  }

  if (autos.has('lead_mark_won') && project.leadId) {
    await Lead.updateOne({ _id: project.leadId, orgId: project.orgId }, { $set: { status: 'won', projectId: project._id } });
    effects.push('Marked lead as won');
  }
  if (autos.has('reserve_boq_stock')) {
    set.boqReserved = true;
    effects.push('Reserved BOQ stock');
  }
  if (autos.has('set_subsidy_status')) {
    const appNo = toStr(data.subsidyApplicationNo);
    set.subsidy = { ...(project.subsidy ?? {}), status: appNo ? 'applied' : (project.subsidy?.status ?? 'not_applied'), applicationNo: appNo, amount: toNum(data.subsidyAmount) };
    const loanRequired = data.loanRequired === true || data.loanRequired === 'true';
    set.loan = loanRequired
      ? { status: 'applied', bank: toStr(data.loanBank), amount: toNum(data.loanAmount) }
      : { status: 'not_required' };
    effects.push('Updated subsidy / loan status');
  }
  if (autos.has('assign_engineer') && isOid(data.engineerId)) {
    set['team.engineer'] = oid(data.engineerId);
    effects.push('Assigned project engineer');
    await notifyUsers(project.orgId, [data.engineerId], { title: 'You were assigned a project', body: `${project.code} · ${project.customer.name}`, link: `/projects/${project._id}` }, ctx.userId);
  }
  if (autos.has('set_installation_date') && toDate(data.installationDate)) {
    set.installationDate = toDate(data.installationDate);
    effects.push('Set installation date');
  }
  if (autos.has('set_net_metering_submitted')) {
    set['netMetering.status'] = 'submitted';
    if (toStr(data.netMeteringAppNo)) set['netMetering.applicationNo'] = toStr(data.netMeteringAppNo);
    effects.push('Net-metering marked submitted');
  }
  if (autos.has('set_net_metering_inspected')) {
    set['netMetering.status'] = 'inspected';
    effects.push('Net-metering marked inspected');
  }
  if (autos.has('set_net_metering_meter_installed')) {
    set['netMetering.status'] = 'meter_installed';
    if (toStr(data.meterNumber)) set['netMetering.meterNumber'] = toStr(data.meterNumber);
    effects.push('Net meter installed');
  }
  if (autos.has('request_review')) {
    set.reviewRequestedAt = new Date();
    const rating = toNum(data.rating);
    if (rating !== undefined) set.rating = Math.max(1, Math.min(5, rating));
    if (project.customerUserId) {
      const org = await Org.findById(project.orgId).select('settings.googleReviewUrl').lean();
      await notifyUsers(project.orgId, [project.customerUserId], {
        title: 'How did we do?',
        body: 'Please rate your solar installation experience.',
        link: org?.settings?.googleReviewUrl || `/portal/projects/${project._id}`,
      });
    }
    effects.push('Review requested');
  }
  if (autos.has('create_dispatch')) {
    const existing = await Dispatch.exists({ orgId: project.orgId, projectId: project._id, status: { $ne: 'cancelled' } });
    const lines = (project.boq ?? []).filter((b) => b.itemId && b.quantity > 0);
    if (!existing && lines.length) {
      const merged = new Map<string, number>();
      for (const l of lines) merged.set(String(l.itemId), (merged.get(String(l.itemId)) ?? 0) + l.quantity);
      const d = await createDispatch(ctx, {
        projectId: String(project._id),
        items: [...merged].map(([itemId, quantity]) => ({ itemId, quantity })),
        scheduledDate: toDate(data.dispatchDate) ?? new Date(),
        vehicleNo: toStr(data.vehicleNo),
        driverPhone: toStr(data.driverPhone),
        notes: 'Created automatically from BOQ at dispatch planning',
      });
      effects.push(`Created dispatch ${d.code} from BOQ`);
    }
  }
  if (autos.has('close_project')) {
    set.status = 'completed';
    set.completedAt = new Date();
    effects.push('Project closed');
  }
  return { set, effects };
}

// ───────────────────────────── stage update ─────────────────────────────

export async function updateStage(ctx: Ctx, projectId: string, stageKey: string, input: StageUpdateInput): Promise<ProjectDoc> {
  if (!isOid(projectId)) throw notFound('Project');
  const found = await Project.findOne({ ...projectScope(ctx), _id: projectId }).lean();
  if (!found) throw notFound('Project');
  const { org } = await orgAndCatalogue(ctx.orgId);
  const project = await syncProjectFeatures(found, org);

  const defs = project.stageDefinitions;
  const def = defs.find((d) => d.key === stageKey);
  const idx = project.stages.findIndex((s) => s.key === stageKey);
  if (!def || idx < 0) throw notFound('Stage');

  const stages = cloneStages(project.stages);
  const state = stages[idx]!;
  const canOverride = can(ctx, 'workflow:override');
  const reasons: string[] = [];
  const now = new Date();

  // Rule 1 — locked
  if (state.status === 'locked' && !canOverride) {
    const waiting = def.dependsOn.filter((k) => !isStageDone(stages.find((s) => s.key === k)?.status)).map((k) => stageName(defs, k));
    reasons.push(`Stage is locked until these stages are completed: ${waiting.join(', ') || 'dependencies'}`);
  }
  // Rule 2 — role
  const roleAllowed = def.ownerRoles.includes(ctx.roleKey) || PRIVILEGED_ROLES.includes(ctx.roleKey) || canOverride || sameId(state.assignee, ctx.userId);
  if (!roleAllowed) reasons.push(`Your role (${ctx.roleKey}) cannot update this stage; it is owned by: ${def.ownerRoles.join(', ')}`);

  const onlyNote = input.note !== undefined && input.status === undefined && !input.checklist && !input.data && input.assigneeId === undefined && input.blockedReason === undefined;
  if (isStageDone(state.status) && !onlyNote && !(state.autoSkipped && canOverride)) {
    reasons.push(`Stage is already ${state.status}; reopen it before making changes`);
  }
  if (state.autoSkipped && input.status && input.status !== 'skipped' && !canOverride) {
    reasons.push('Stage is disabled for your organisation (feature turned off)');
  }

  if (input.assigneeId !== undefined && input.assigneeId !== null) {
    if (!can(ctx, 'projects:assign') && !canOverride) reasons.push('Assigning a stage requires the projects:assign permission');
    else if (!(await User.exists({ _id: input.assigneeId, orgId: ctx.orgOid, isActive: true }))) reasons.push('Assignee must be an active user in your organisation');
  }

  // Merge checklist (by label) and data.
  if (input.checklist) {
    const byLabel = new Map(input.checklist.map((c) => [c.label, c.done]));
    state.checklist = state.checklist.map((c) => (byLabel.has(c.label) ? { label: c.label, done: byLabel.get(c.label)! } : c));
  }
  if (input.data) state.data = coerceData(def, { ...(state.data ?? {}), ...input.data });

  const target = input.status;
  if (target === 'completed') reasons.push(...(await completionReasons(project, def, state, org)));
  if (target === 'skipped' && !def.optional && !canOverride) reasons.push('Only optional stages can be skipped');
  if (target === 'blocked' && isBlank(input.blockedReason ?? state.blockedReason)) reasons.push('Give a reason when blocking a stage');

  if (reasons.length) throw stageRule(reasons);

  // Apply.
  const prevStatus = state.status;
  if (input.assigneeId !== undefined) state.assignee = input.assigneeId ? oid(input.assigneeId) : null;
  if (input.note?.trim()) state.notes = [...(state.notes ?? []), { body: input.note.trim(), by: ctx.userOid, at: now }];
  if (target && target !== prevStatus) {
    state.status = target;
    if (target === 'in_progress' || target === 'completed' || target === 'blocked') state.startedAt ??= now;
    if (target === 'completed' || target === 'skipped') {
      state.completedAt = now;
      state.completedBy = ctx.userOid;
      if (target === 'skipped') state.autoSkipped = false;
    }
    if (target === 'blocked') state.blockedReason = input.blockedReason ?? state.blockedReason;
    else state.blockedReason = null;
    if (target === 'pending' && prevStatus === 'locked') state.dueAt ??= new Date(now.getTime() + def.slaDays * DAY_MS);
  } else if (input.blockedReason !== undefined && state.status === 'blocked') {
    state.blockedReason = input.blockedReason;
  }
  // Working on a pending stage implicitly starts it.
  if (!target && state.status === 'pending' && (input.checklist || input.data)) {
    state.status = 'in_progress';
    state.startedAt ??= now;
  }

  const unlocked = recomputeStages(stages, defs, now);
  const derived = derivedFields(stages, defs);

  const auto = target === 'completed' && prevStatus !== 'completed' ? await runAutomations(ctx, project, def, state.data) : { set: {}, effects: [] as string[] };
  // A reopened closure may be re-closed; any other change keeps a completed project completed.
  const updated = await Project.findOneAndUpdate(
    { _id: project._id, orgId: ctx.orgOid, updatedAt: project.updatedAt },
    { $set: { stages, ...derived, ...auto.set } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw conflict('The project was changed by someone else. Reload and try again.');

  const verb = target && target !== prevStatus ? target.replace('_', ' ') : 'updated';
  await audit(ctx, {
    action: target && target !== prevStatus ? `stage.${target}` : 'stage.update',
    entity: 'project',
    entityId: project._id,
    projectId: project._id,
    summary: `${def.name}: ${verb}${auto.effects.length ? ` (${auto.effects.join('; ')})` : ''} on ${project.code}`,
    changes: target && target !== prevStatus ? { [`stages.${def.key}.status`]: { from: prevStatus, to: target } } : undefined,
  });

  if (unlocked.length) await notifyStageOwners(updated, unlocked, ctx.userId);
  if (input.assigneeId && !sameId(input.assigneeId, project.stages[idx]?.assignee)) {
    await notifyUsers(ctx.orgId, [input.assigneeId], { title: `Assigned: ${def.name}`, body: `${project.code} · ${project.customer.name}`, link: `/projects/${project._id}?stage=${def.key}` }, ctx.userId);
  }
  return updated;
}

/** Set a completed/skipped/blocked stage back to in_progress (workflow:override). */
export async function reopenStage(ctx: Ctx, projectId: string, stageKey: string): Promise<ProjectDoc> {
  if (!isOid(projectId)) throw notFound('Project');
  const project = await Project.findOne({ ...projectScope(ctx), _id: projectId }).lean();
  if (!project) throw notFound('Project');
  const def = project.stageDefinitions.find((d) => d.key === stageKey);
  const stages = cloneStages(project.stages);
  const state = stages.find((s) => s.key === stageKey);
  if (!def || !state) throw notFound('Stage');
  if (state.status === 'locked' || state.status === 'pending' || state.status === 'in_progress') {
    throw stageRule([`Stage is ${state.status}; only completed, skipped or blocked stages can be reopened`]);
  }
  const prev = state.status;
  state.status = 'in_progress';
  state.completedAt = null;
  state.completedBy = null;
  state.autoSkipped = false;
  state.blockedReason = null;
  state.startedAt ??= new Date();
  recomputeStages(stages, project.stageDefinitions);
  const set: Record<string, unknown> = { stages, ...derivedFields(stages, project.stageDefinitions) };
  if (project.status === 'completed' && (def.automations ?? []).includes('close_project')) {
    set.status = 'active';
    set.completedAt = null;
  }
  const updated = await Project.findOneAndUpdate({ _id: project._id, orgId: ctx.orgOid }, { $set: set }, { returnDocument: 'after' }).lean();
  await audit(ctx, {
    action: 'stage.reopen',
    entity: 'project',
    entityId: project._id,
    projectId: project._id,
    summary: `${def.name}: reopened on ${project.code}`,
    changes: { [`stages.${def.key}.status`]: { from: prev, to: 'in_progress' } },
  });
  return updated!;
}
