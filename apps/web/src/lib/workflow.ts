import { isPast, parseISO } from 'date-fns';
import { DEFAULT_ADVANCE_PERCENT, DOCUMENT_TYPE_LABELS, hasPermission, PHASES, type DocumentType, type PhaseDefinition, type StageDefinition } from '@solar/shared';
import type { Project, ProjectStage, Session } from './types';

export interface StageView {
  def: StageDefinition;
  state: ProjectStage;
}

export interface PhaseView {
  phase: PhaseDefinition;
  stages: StageView[];
  done: number;
}

const EMPTY_STATE = (key: string): ProjectStage => ({ key, status: 'locked', checklist: [], data: {}, notes: [] });

/** Joins the project's workflow snapshot with its live stage states, grouped by phase in step order. */
export function projectPhases(project: Pick<Project, 'stageDefinitions' | 'stages'>): PhaseView[] {
  const states = new Map(project.stages.map((s) => [s.key, s]));
  return PHASES.map((phase) => {
    const stages = project.stageDefinitions
      .filter((d) => d.phase === phase.key && d.enabled !== false)
      .sort((a, b) => a.step - b.step)
      .map((def) => ({ def, state: states.get(def.key) ?? EMPTY_STATE(def.key) }));
    return { phase, stages, done: stages.filter((s) => s.state.status === 'completed' || s.state.status === 'skipped').length };
  }).filter((p) => p.stages.length > 0);
}

export function findStage(project: Pick<Project, 'stageDefinitions' | 'stages'>, key: string): StageView | null {
  const def = project.stageDefinitions.find((d) => d.key === key);
  if (!def) return null;
  return { def, state: project.stages.find((s) => s.key === key) ?? EMPTY_STATE(key) };
}

export function isStageOverdue(state: Pick<ProjectStage, 'status' | 'dueAt'>): boolean {
  if (!state.dueAt || state.status === 'completed' || state.status === 'skipped' || state.status === 'locked') return false;
  return isPast(parseISO(state.dueAt));
}

/** Checklist to show: saved state if present, else the definition's items unticked. */
export function stageChecklist(view: StageView): { label: string; done: boolean }[] {
  if (view.state.checklist.length > 0) return view.state.checklist;
  return view.def.checklist.map((label) => ({ label, done: false }));
}

/** Mirrors API rule 2: owner roles, owner/admin, workflow:override, or the assignee. */
export function canActOnStage(session: Session, view: StageView): boolean {
  if (!hasPermission(session.permissions, 'workflow:advance')) return false;
  const role = session.user.roleKey;
  return (
    view.def.ownerRoles.includes(role) ||
    role === 'owner' ||
    role === 'admin' ||
    hasPermission(session.permissions, 'workflow:override') ||
    view.state.assignee?.id === session.user.id
  );
}

export interface Requirement {
  key: string;
  label: string;
  met: boolean;
}

function filled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/**
 * Client-side preview of API rule 3 so users see what's missing *before* pressing Complete.
 * The API remains the source of truth (its STAGE_RULE reasons are shown on failure).
 */
export function completionRequirements(
  view: StageView,
  opts: {
    checklist: { label: string; done: boolean }[];
    data: Record<string, unknown>;
    presentDocTypes: Set<string>;
    received?: number;
    contractValue: number;
    advancePercent?: number;
  },
): Requirement[] {
  const reqs: Requirement[] = [];
  for (const d of view.def.requiredDocuments) {
    reqs.push({ key: `doc-${d}`, label: `Upload ${DOCUMENT_TYPE_LABELS[d as DocumentType] ?? d}`, met: opts.presentDocTypes.has(d) });
  }
  const unchecked = opts.checklist.filter((c) => !c.done).length;
  if (opts.checklist.length > 0) {
    reqs.push({ key: 'checklist', label: unchecked === 0 ? 'Checklist complete' : `Tick ${unchecked} remaining checklist item${unchecked === 1 ? '' : 's'}`, met: unchecked === 0 });
  }
  for (const f of view.def.fields.filter((x) => x.required)) {
    reqs.push({ key: `field-${f.key}`, label: `Fill “${f.label}”`, met: filled(opts.data[f.key]) });
  }
  if (view.def.requiresAdvancePayment && opts.received !== undefined) {
    const pct = opts.advancePercent ?? DEFAULT_ADVANCE_PERCENT;
    const needed = (opts.contractValue * pct) / 100;
    reqs.push({ key: 'advance', label: `Receive at least ${pct}% advance`, met: opts.received >= needed });
  }
  if (view.def.requiresFullPayment && opts.received !== undefined) {
    reqs.push({ key: 'full', label: 'Receive the full contract amount', met: opts.received >= opts.contractValue });
  }
  return reqs;
}
