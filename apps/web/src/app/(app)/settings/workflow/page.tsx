'use client';

import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, PHASES, validateWorkflow, type DocumentType, type StageDefinition } from '@solar/shared';
import { useResetWorkflow, useSaveWorkflow, useWorkflow } from '@/hooks/api/use-org';
import { useRoles } from '@/hooks/api/use-team';
import { useCan } from '@/hooks/use-session';
import type { Workflow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { roleShort } from '@/lib/roles';
import { TONE_STYLES } from '@/lib/status';
import { Require } from '@/components/auth/require';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function WorkflowSettingsPage() {
  return (
    <Require permission="workflow:manage">
      <WorkflowLoader />
    </Require>
  );
}

function WorkflowLoader() {
  const { data, isLoading, error, refetch } = useWorkflow();
  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <WorkflowEditor key={data.version} workflow={data} />;
}

/**
 * Edits the org workflow template. Saving bumps the version; existing projects keep the snapshot
 * they were created with. Validated client-side with the same `validateWorkflow` the API uses.
 */
function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  const canCustomise = useCan({ feature: 'workflow_customisation' });
  const save = useSaveWorkflow();
  const reset = useResetWorkflow();
  const [stages, setStages] = useState<StageDefinition[]>(() => structuredClone(workflow.stages));
  const [open, setOpen] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const errors = useMemo(() => validateWorkflow(stages), [stages]);
  const dirty = JSON.stringify(stages) !== JSON.stringify(workflow.stages);

  const patch = (key: string, p: Partial<StageDefinition>) => setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...p } : s)));

  /** Swap step numbers with the neighbour in the same phase. */
  const move = (key: string, dir: -1 | 1) =>
    setStages((ss) => {
      const stage = ss.find((s) => s.key === key);
      if (!stage) return ss;
      const siblings = ss.filter((s) => s.phase === stage.phase).sort((a, b) => a.step - b.step);
      const idx = siblings.findIndex((s) => s.key === key);
      const other = siblings[idx + dir];
      if (!other) return ss;
      return ss.map((s) => (s.key === stage.key ? { ...s, step: other.step } : s.key === other.key ? { ...s, step: stage.step } : s));
    });

  const readOnly = !canCustomise;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Version <span className="font-semibold text-foreground">{workflow.version}</span> · {stages.length} stages. Changes apply to <em>new</em> projects; running projects keep the version they started with.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={readOnly}>
            <RotateCcw /> Reset to defaults
          </Button>
          {dirty && (
            <Button variant="outline" onClick={() => setStages(structuredClone(workflow.stages))}>
              <Undo2 /> Discard
            </Button>
          )}
          <Button onClick={() => save.mutate(stages)} disabled={!dirty || errors.length > 0 || readOnly} loading={save.isPending}>
            <Save /> Save workflow
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-xl border border-amber-300 bg-accent-soft px-4 py-3 text-sm dark:border-amber-500/30">Workflow customisation isn&apos;t enabled for your plan. You can review the workflow but not change it.</div>
      )}
      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Fix these before saving
          </p>
          <ul className="mt-1.5 list-disc pl-6">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {PHASES.map((phase) => {
        const phaseStages = stages.filter((s) => s.phase === phase.key).sort((a, b) => a.step - b.step);
        const tone = TONE_STYLES[phase.color];
        return (
          <section key={phase.key} aria-labelledby={`wf-${phase.key}`}>
            <h2 id={`wf-${phase.key}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className={cn('flex size-6 items-center justify-center rounded-md text-xs font-bold text-white', tone.dot)}>{phase.order}</span>
              {phase.name}
              <span className="font-normal text-muted-foreground">({phaseStages.length})</span>
            </h2>
            <div className="space-y-2">
              {phaseStages.map((s, i) => (
                <StageEditor
                  key={s.key}
                  stage={s}
                  all={stages}
                  open={open === s.key}
                  onToggle={() => setOpen((o) => (o === s.key ? null : s.key))}
                  onChange={(p) => patch(s.key, p)}
                  onMove={(d) => move(s.key, d)}
                  first={i === 0}
                  last={i === phaseStages.length - 1}
                  readOnly={readOnly}
                  toneBorder={tone.border}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset workflow to SolarFlow defaults?"
        description="All your customisations to stage names, owners, SLAs and checklists are replaced. Running projects are not affected."
        destructive
        confirmLabel="Reset workflow"
        loading={reset.isPending}
        onConfirm={() => reset.mutate(undefined, { onSuccess: () => setConfirmReset(false) })}
      />
    </div>
  );
}

function StageEditor({
  stage,
  all,
  open,
  onToggle,
  onChange,
  onMove,
  first,
  last,
  readOnly,
  toneBorder,
}: {
  stage: StageDefinition;
  all: StageDefinition[];
  open: boolean;
  onToggle: () => void;
  onChange: (p: Partial<StageDefinition>) => void;
  onMove: (d: -1 | 1) => void;
  first: boolean;
  last: boolean;
  readOnly: boolean;
  toneBorder: string;
}) {
  const { data: roles } = useRoles();
  const disabled = stage.enabled === false;
  const roleOptions = (roles ?? []).filter((r) => r.key !== 'customer').map((r) => ({ value: r.key, label: r.name }));
  const depOptions = all.filter((s) => s.key !== stage.key).sort((a, b) => a.step - b.step).map((s) => ({ value: s.key, label: `${s.step}. ${s.name}` }));

  return (
    <Card className={cn('border-l-4', toneBorder, disabled && 'opacity-60')}>
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col">
          <Button variant="ghost" size="icon-sm" className="size-6" disabled={first || readOnly} onClick={() => onMove(-1)} aria-label={`Move ${stage.name} up`}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-6" disabled={last || readOnly} onClick={() => onMove(1)} aria-label={`Move ${stage.name} down`}>
            <ArrowDown className="size-3.5" />
          </Button>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="tabular w-6 text-xs text-muted-foreground">#{stage.step}</span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-sm font-semibold', disabled && 'line-through')}>{stage.name}</span>
            <span className="flex flex-wrap gap-1 pt-0.5">
              {stage.ownerRoles.map((r) => (
                <span key={r} className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                  {roleShort(r)}
                </span>
              ))}
              <span className="text-[10px] text-muted-foreground">· SLA {stage.slaDays}d</span>
              {stage.optional && <Badge>Optional</Badge>}
            </span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {stage.optional && (
          <Switch checked={!disabled} disabled={readOnly} onCheckedChange={(c) => onChange({ enabled: c })} aria-label={`${disabled ? 'Enable' : 'Disable'} ${stage.name}`} />
        )}
      </div>
      {open && (
        <fieldset disabled={readOnly} className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
          <FormField label="Name">
            <Input value={stage.name} onChange={(e) => onChange({ name: e.target.value })} />
          </FormField>
          <FormField label="SLA (days)">
            <Input type="number" min={0} value={stage.slaDays} onChange={(e) => onChange({ slaDays: Math.max(0, Number(e.target.value)) })} />
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <Textarea rows={2} value={stage.description} onChange={(e) => onChange({ description: e.target.value })} />
          </FormField>
          <FormField label="Owner roles" htmlFor={`own-${stage.key}`}>
            <MultiSelect id={`own-${stage.key}`} value={stage.ownerRoles} onChange={(ownerRoles) => onChange({ ownerRoles })} options={roleOptions} disabled={readOnly} />
          </FormField>
          <FormField label="Starts after (depends on)" htmlFor={`dep-${stage.key}`}>
            <MultiSelect id={`dep-${stage.key}`} value={stage.dependsOn} onChange={(dependsOn) => onChange({ dependsOn })} options={depOptions} placeholder="Starts immediately" disabled={readOnly} />
          </FormField>
          <FormField label="Required documents" className="sm:col-span-2" htmlFor={`docs-${stage.key}`}>
            <MultiSelect
              id={`docs-${stage.key}`}
              value={stage.requiredDocuments}
              onChange={(v) => onChange({ requiredDocuments: v as DocumentType[] })}
              options={DOCUMENT_TYPES.map((d) => ({ value: d, label: DOCUMENT_TYPE_LABELS[d] }))}
              placeholder="None"
              disabled={readOnly}
            />
          </FormField>
          <ChecklistEditor items={stage.checklist} onChange={(checklist) => onChange({ checklist })} readOnly={readOnly} />
          {stage.fields.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Form fields: {stage.fields.map((f) => `${f.label}${f.required ? '*' : ''}`).join(', ')}
            </p>
          )}
        </fieldset>
      )}
    </Card>
  );
}

function ChecklistEditor({ items, onChange, readOnly }: { items: string[]; onChange: (v: string[]) => void; readOnly: boolean }) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium">Checklist</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label={`Checklist item ${i + 1}`} value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button variant="ghost" size="icon" aria-label={`Remove checklist item ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={readOnly}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, ''])} disabled={readOnly}>
        <Plus /> Add item
      </Button>
    </div>
  );
}
