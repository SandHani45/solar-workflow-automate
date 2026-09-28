'use client';

import { ArrowRight, Clock, FileCheck2, GitBranch, IndianRupee, ListChecks, SkipForward, ToggleRight, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DEFAULT_STAGES, DOCUMENT_TYPE_LABELS, FEATURE_CATALOGUE, PHASES, type PhaseKey } from '@solar/shared';
import { cn } from '@/lib/utils';
import { roleShort } from '@/lib/roles';
import { TONE_STYLES } from '@/lib/status';

const STAGE_NAME = new Map(DEFAULT_STAGES.map((s) => [s.key, s.name]));
const FEATURE_NAME = new Map(FEATURE_CATALOGUE.map((f) => [f.key, f.name]));

/**
 * Interactive explainer built straight from the shared workflow definition — the same data the
 * engine runs on, so the landing page can never drift from the product.
 */
export function WorkflowExplorer() {
  const [phaseKey, setPhaseKey] = useState<PhaseKey>('sales');
  const phase = PHASES.find((p) => p.key === phaseKey) ?? PHASES[0]!;
  const stages = DEFAULT_STAGES.filter((s) => s.phase === phase.key);
  const tone = TONE_STYLES[phase.color];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Phase rail: horizontal scroller on phones, vertical timeline on desktop */}
      <div role="tablist" aria-label="Workflow phases" aria-orientation="vertical" className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {PHASES.map((p) => {
          const active = p.key === phase.key;
          const t = TONE_STYLES[p.color];
          const count = DEFAULT_STAGES.filter((s) => s.phase === p.key).length;
          return (
            <button
              key={p.key}
              role="tab"
              type="button"
              id={`phase-tab-${p.key}`}
              aria-selected={active}
              aria-controls="phase-panel"
              onClick={() => setPhaseKey(p.key)}
              className={cn(
                'group relative flex min-w-[220px] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all lg:min-w-0',
                active ? cn('border-transparent bg-card shadow-md ring-2', t.ring) : 'border-border bg-card/60 hover:bg-card',
              )}
            >
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white', t.dot)}>{p.order}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {count} stage{count === 1 ? '' : 's'} · {p.description}
                </span>
              </span>
              <ArrowRight className={cn('hidden size-4 shrink-0 transition-opacity lg:block', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')} aria-hidden />
            </button>
          );
        })}
      </div>

      <div id="phase-panel" role="tabpanel" aria-labelledby={`phase-tab-${phase.key}`} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tone.badge)}>Phase {phase.order}</span>
          <h3 className="text-lg font-semibold">{phase.name}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>

        <ol className="mt-5 space-y-3">
          {stages.map((s) => (
            <li key={s.key} className={cn('rounded-xl border border-l-4 border-border bg-background/60 p-4', tone.border)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Step {s.step}</p>
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden /> SLA {s.slaDays}d
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Owners</dt>
                  <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <dd className="flex flex-wrap gap-1">
                    {s.ownerRoles.map((r) => (
                      <span key={r} className="rounded bg-primary-soft px-1.5 py-0.5 font-medium text-primary dark:text-blue-300">
                        {roleShort(r)}
                      </span>
                    ))}
                  </dd>
                </div>
                {s.dependsOn.length > 0 && (
                  <div className="flex items-start gap-2">
                    <dt className="sr-only">Starts after</dt>
                    <GitBranch className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <dd className="text-muted-foreground">After {s.dependsOn.map((d) => STAGE_NAME.get(d) ?? d).join(' + ')}</dd>
                  </div>
                )}
                {s.requiredDocuments.length > 0 && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <dt className="sr-only">Required documents</dt>
                    <FileCheck2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <dd className="flex flex-wrap gap-1">
                      {s.requiredDocuments.map((d) => (
                        <span key={d} className="rounded border border-border px-1.5 py-0.5">
                          {DOCUMENT_TYPE_LABELS[d]}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Checklist</dt>
                  <ListChecks className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <dd className="text-muted-foreground">
                    {s.checklist.length} checklist item{s.checklist.length === 1 ? '' : 's'}
                    {s.fields.length > 0 && ` · ${s.fields.length} form field${s.fields.length === 1 ? '' : 's'}`}
                  </dd>
                </div>
              </dl>
              {(s.requiresAdvancePayment || s.requiresFullPayment || s.optional || s.feature) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.requiresAdvancePayment && <Gate icon={<IndianRupee />} label="Needs advance payment" />}
                  {s.requiresFullPayment && <Gate icon={<IndianRupee />} label="Needs full payment" />}
                  {s.optional && <Gate icon={<SkipForward />} label="Optional" />}
                  {s.feature && <Gate icon={<ToggleRight />} label={`Module: ${FEATURE_NAME.get(s.feature) ?? s.feature}`} />}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Gate({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/20 ring-inset dark:text-amber-300 [&_svg]:size-3">
      {icon}
      {label}
    </span>
  );
}
