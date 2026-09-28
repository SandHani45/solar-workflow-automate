import { PHASES, type PhaseDefinition, type PhaseKey } from '@solar/shared';

/** Colour tone vocabulary shared by Badge, phase columns and charts. */
export type Tone = 'neutral' | 'blue' | 'orange' | 'green' | 'purple' | 'teal' | 'red' | 'gold' | 'amber' | 'primary';

/** Full class strings (Tailwind needs literal class names to generate them). */
export const TONE_STYLES: Record<Tone, { badge: string; dot: string; soft: string; border: string; ring: string; text: string; hex: string }> = {
  neutral: { badge: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-400', soft: 'bg-slate-50 dark:bg-slate-500/10', border: 'border-slate-400', ring: 'ring-slate-400', text: 'text-slate-600 dark:text-slate-300', hex: '#94a3b8' },
  blue: { badge: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500', soft: 'bg-blue-50/70 dark:bg-blue-500/10', border: 'border-blue-500', ring: 'ring-blue-500', text: 'text-blue-600 dark:text-blue-400', hex: '#3b82f6' },
  orange: { badge: 'bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/15 dark:text-orange-300', dot: 'bg-orange-500', soft: 'bg-orange-50/70 dark:bg-orange-500/10', border: 'border-orange-500', ring: 'ring-orange-500', text: 'text-orange-600 dark:text-orange-400', hex: '#f97316' },
  green: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500', soft: 'bg-emerald-50/70 dark:bg-emerald-500/10', border: 'border-emerald-500', ring: 'ring-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', hex: '#10b981' },
  purple: { badge: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500', soft: 'bg-violet-50/70 dark:bg-violet-500/10', border: 'border-violet-500', ring: 'ring-violet-500', text: 'text-violet-600 dark:text-violet-400', hex: '#8b5cf6' },
  teal: { badge: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/15 dark:text-teal-300', dot: 'bg-teal-500', soft: 'bg-teal-50/70 dark:bg-teal-500/10', border: 'border-teal-500', ring: 'ring-teal-500', text: 'text-teal-600 dark:text-teal-400', hex: '#14b8a6' },
  red: { badge: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500', soft: 'bg-rose-50/70 dark:bg-rose-500/10', border: 'border-rose-500', ring: 'ring-rose-500', text: 'text-rose-600 dark:text-rose-400', hex: '#f43f5e' },
  gold: { badge: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-500/15 dark:text-yellow-300', dot: 'bg-yellow-500', soft: 'bg-yellow-50/70 dark:bg-yellow-500/10', border: 'border-yellow-500', ring: 'ring-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', hex: '#eab308' },
  amber: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', soft: 'bg-amber-50/70 dark:bg-amber-500/10', border: 'border-amber-500', ring: 'ring-amber-500', text: 'text-amber-700 dark:text-amber-400', hex: '#f59e0b' },
  primary: { badge: 'bg-primary-soft text-primary ring-primary/15 dark:text-blue-300', dot: 'bg-primary', soft: 'bg-primary-soft', border: 'border-primary', ring: 'ring-primary', text: 'text-primary', hex: '#1e3a8a' },
};

export const PHASE_BY_KEY: Record<PhaseKey, PhaseDefinition> = Object.fromEntries(PHASES.map((p) => [p.key, p])) as Record<PhaseKey, PhaseDefinition>;

export function phaseTone(phase: PhaseKey | undefined): Tone {
  return phase ? PHASE_BY_KEY[phase]?.color ?? 'neutral' : 'neutral';
}

const STATUS_TONES: Record<string, Tone> = {
  // stages
  locked: 'neutral',
  pending: 'amber',
  in_progress: 'blue',
  blocked: 'red',
  completed: 'green',
  skipped: 'neutral',
  // projects
  active: 'blue',
  on_hold: 'amber',
  cancelled: 'red',
  // leads
  new: 'blue',
  contacted: 'teal',
  quotation_sent: 'purple',
  survey_scheduled: 'orange',
  negotiation: 'amber',
  won: 'green',
  lost: 'red',
  // quotations
  draft: 'neutral',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  superseded: 'neutral',
  // dispatch
  planned: 'neutral',
  packed: 'purple',
  in_transit: 'blue',
  delivered: 'teal',
  unloaded: 'green',
  // tickets
  open: 'blue',
  assigned: 'purple',
  resolved: 'green',
  closed: 'neutral',
  // priority
  low: 'neutral',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
  // expenses / advances
  approved: 'green',
  outstanding: 'amber',
  settled: 'green',
  // stock movements
  in: 'green',
  out: 'orange',
  adjust: 'purple',
  return: 'teal',
  // subsidy / loan / net-metering
  not_applied: 'neutral',
  applied: 'blue',
  under_review: 'amber',
  disbursed: 'green',
  not_required: 'neutral',
  sanctioned: 'teal',
  not_started: 'neutral',
  submitted: 'blue',
  inspection_scheduled: 'amber',
  inspected: 'teal',
  meter_installed: 'green',
  // plans
  starter: 'neutral',
  growth: 'blue',
  enterprise: 'gold',
};

export function statusTone(status: string | undefined | null): Tone {
  return (status && STATUS_TONES[status]) || 'neutral';
}

/** Distinct series colours for categorical charts (validated for contrast in both themes). */
export const CHART_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#14b8a6', '#f43f5e', '#eab308', '#64748b', '#0ea5e9', '#f97316', '#84cc16'];
