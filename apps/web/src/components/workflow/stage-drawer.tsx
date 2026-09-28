'use client';

import { AlertTriangle, Ban, CheckCircle2, Circle, Clock, Lock, Play, RotateCcw, Save, SkipForward, UserRound } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, hasPermission, type DocumentType, type StageUpdateInput } from '@solar/shared';
import { useUploadDocument } from '@/hooks/api/use-documents';
import { useReopenStage, useUpdateStage } from '@/hooks/api/use-projects';
import { useUserOptions } from '@/hooks/api/use-team';
import { useSession } from '@/hooks/use-session';
import { ApiError, errorMessage } from '@/lib/api-client';
import { roleName, roleShort } from '@/lib/roles';
import { phaseTone } from '@/lib/status';
import type { Project, ProjectDocument } from '@/lib/types';
import { cn, formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import { canActOnStage, completionRequirements, findStage, isStageOverdue, stageChecklist, type StageView } from '@/lib/workflow';
import { DocumentLink } from '@/components/documents/document-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { PhaseBadge } from './phase-badge';
import { StageFieldInput } from './stage-field-input';
import { StageStatusBadge, StageStatusIcon } from './stage-status';

interface StageDrawerProps {
  project: Project;
  stageKey: string | null;
  documents: ProjectDocument[];
  onOpenChange: (open: boolean) => void;
}

export function StageDrawer({ project, stageKey, documents, onOpenChange }: StageDrawerProps) {
  const view = stageKey ? findStage(project, stageKey) : null;
  return (
    <Sheet
      open={!!view}
      onOpenChange={onOpenChange}
      size="lg"
      title={view?.def.name ?? 'Stage'}
      description={view?.def.description}
      eyebrow={
        view && (
          <>
            <PhaseBadge phase={view.def.phase} />
            <Badge>Step {view.def.step}</Badge>
            <StageStatusBadge status={view.state.status} />
            {isStageOverdue(view.state) && <Badge tone="red">Overdue</Badge>}
          </>
        )
      }
    >
      {/* Keyed so local edits reset when a different stage opens. */}
      {view && <StageDrawerBody key={view.def.key} project={project} view={view} documents={documents} onClose={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function StageDrawerBody({ project, view, documents, onClose }: { project: Project; view: StageView; documents: ProjectDocument[]; onClose: () => void }) {
  const session = useSession();
  const { def, state } = view;
  const canAct = canActOnStage(session, view);
  const canOverride = hasPermission(session.permissions, 'workflow:override');
  const canAssign = canOverride || hasPermission(session.permissions, 'projects:assign');
  const canUpload = hasPermission(session.permissions, 'documents:write');

  const update = useUpdateStage(project.id);
  const reopen = useReopenStage(project.id);
  const upload = useUploadDocument();

  const [checklist, setChecklist] = useState(() => stageChecklist(view));
  const [data, setData] = useState<Record<string, unknown>>(() => ({ ...state.data }));
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ruleReasons, setRuleReasons] = useState<string[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [extraType, setExtraType] = useState<DocumentType>(def.requiredDocuments[0] ?? 'site_photo');

  const locked = state.status === 'locked';
  const finished = state.status === 'completed' || state.status === 'skipped';
  const editable = canAct && !finished && (!locked || canOverride);
  const dirty = JSON.stringify(data) !== JSON.stringify(state.data ?? {}) || note.trim().length > 0;

  const docsByType = useMemo(() => {
    const m = new Map<string, ProjectDocument[]>();
    for (const d of documents) m.set(d.type, [...(m.get(d.type) ?? []), d]);
    return m;
  }, [documents]);
  const stageDocs = documents.filter((d) => d.stageKey === def.key && !def.requiredDocuments.includes(d.type));

  const requirements = completionRequirements(view, {
    checklist,
    data,
    presentDocTypes: new Set(docsByType.keys()),
    received: project.financialSummary?.received,
    contractValue: project.contractValue,
    advancePercent: session.org?.settings.advancePercent,
  });
  const unmet = requirements.filter((r) => !r.met);

  const send = (body: StageUpdateInput, done?: string) => {
    setRuleReasons([]);
    update.mutate(
      { stageKey: def.key, body: note.trim() ? { ...body, note: note.trim() } : body },
      {
        onSuccess: () => {
          setNote('');
          if (done) toast.success(done);
          if (body.status === 'completed' || body.status === 'skipped') onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'STAGE_RULE') setRuleReasons(err.reasons.length ? err.reasons : [err.message]);
          else toast.error(errorMessage(err));
        },
      },
    );
  };

  const toggleItem = (index: number, done: boolean) => {
    const next = checklist.map((c, i) => (i === index ? { ...c, done } : c));
    setChecklist(next);
    // Persist ticks immediately (optimistic) — engineers tick items one by one on site.
    update.mutate({ stageKey: def.key, body: { checklist: next } }, { onError: () => setChecklist(checklist) });
  };

  const complete = () => {
    const missing: Record<string, string> = {};
    for (const f of def.fields) {
      const v = data[f.key];
      if (f.required && (v === undefined || v === null || v === '')) missing[f.key] = 'Required to complete this stage';
    }
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) {
      setRuleReasons(Object.keys(missing).map((k) => `“${def.fields.find((f) => f.key === k)?.label}” is required`));
      return;
    }
    send({ status: 'completed', checklist, data }, 'Stage completed');
  };

  const doUpload = (type: DocumentType) => (file: File, onProgress: (p: number) => void) => upload.mutateAsync({ file, type, projectId: project.id, stageKey: def.key, onProgress });

  const busy = update.isPending || reopen.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6 pb-4">
        {/* Status context */}
        {locked && (
          <Callout tone="neutral" icon={<Lock />} title="Waiting on earlier stages">
            <ul className="mt-1.5 space-y-1">
              {def.dependsOn.map((dep) => {
                const d = findStage(project, dep);
                return (
                  <li key={dep} className="flex items-center gap-2">
                    <StageStatusIcon status={d?.state.status ?? 'completed'} className="size-3.5" />
                    {d?.def.name ?? dep}
                  </li>
                );
              })}
            </ul>
          </Callout>
        )}
        {state.status === 'blocked' && (
          <Callout tone="red" icon={<Ban />} title="Blocked">
            {state.blockedReason || 'No reason given.'}
          </Callout>
        )}
        {ruleReasons.length > 0 && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10" data-testid="stage-rule-errors">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" aria-hidden /> This stage can&apos;t be completed yet
            </p>
            <ul className="mt-2 space-y-1.5">
              {ruleReasons.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-rose-800 dark:text-rose-200">
                  <Circle className="mt-1 size-3 shrink-0" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!canAct && !finished && (
          <Callout tone="neutral" icon={<UserRound />} title="Read only">
            This stage is owned by {def.ownerRoles.map(roleName).join(', ')}. You can view it, but only those roles (or the assignee) can update it.
          </Callout>
        )}

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-3">
          <Meta label="Owners">
            <span className="flex flex-wrap gap-1">
              {def.ownerRoles.map((r) => (
                <Badge key={r} tone={phaseTone(def.phase)}>
                  {roleShort(r)}
                </Badge>
              ))}
            </span>
          </Meta>
          <Meta label={finished ? 'Completed' : 'Due'}>
            {finished ? (
              <span>
                {formatDate(state.completedAt)}
                {state.completedBy && <span className="block text-xs text-muted-foreground">by {state.completedBy.name}</span>}
              </span>
            ) : state.dueAt ? (
              <span className={cn(isStageOverdue(state) && 'font-semibold text-rose-600 dark:text-rose-400')}>
                {formatDate(state.dueAt)}
                <span className="block text-xs font-normal text-muted-foreground">{formatRelative(state.dueAt)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">SLA {def.slaDays} day{def.slaDays === 1 ? '' : 's'}</span>
            )}
          </Meta>
          <Meta label="Assignee" className="col-span-2 sm:col-span-1">
            {canAssign && !finished ? (
              <AssigneePicker value={state.assignee?.id ?? ''} ownerRoles={def.ownerRoles} disabled={busy} onChange={(id) => send({ assigneeId: id || null }, 'Assignee updated')} />
            ) : (
              <span>{state.assignee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</span>
            )}
          </Meta>
        </dl>

        {/* What's needed */}
        {!finished && requirements.length > 0 && (
          <section aria-labelledby="req-title">
            <h3 id="req-title" className="mb-2 flex items-center justify-between text-sm font-semibold">
              To complete this stage
              <span className={cn('text-xs font-medium', unmet.length === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                {unmet.length === 0 ? 'Ready to complete' : `${requirements.length - unmet.length}/${requirements.length} done`}
              </span>
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {requirements.map((r) => (
                <li key={r.key} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs', r.met ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-border')}>
                  {r.met ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden /> : <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  {r.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <section aria-labelledby="checklist-title">
            <h3 id="checklist-title" className="mb-2 text-sm font-semibold">
              Checklist <span className="font-normal text-muted-foreground">({checklist.filter((c) => c.done).length}/{checklist.length})</span>
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {checklist.map((item, i) => {
                const id = `chk-${def.key}-${i}`;
                return (
                  <li key={item.label}>
                    <label htmlFor={id} className={cn('flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm', editable && 'cursor-pointer hover:bg-muted/40')}>
                      <Checkbox id={id} checked={item.done} disabled={!editable} onCheckedChange={(c) => toggleItem(i, c === true)} />
                      <span className={cn(item.done && 'text-muted-foreground line-through')}>{item.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Dynamic form */}
        {def.fields.length > 0 && (
          <section aria-labelledby="fields-title">
            <h3 id="fields-title" className="mb-2 text-sm font-semibold">
              Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {def.fields.map((f) => (
                <StageFieldInput
                  key={f.key}
                  field={f}
                  value={data[f.key]}
                  error={fieldErrors[f.key]}
                  disabled={!editable}
                  onChange={(v) => {
                    setData((d) => ({ ...d, [f.key]: v }));
                    if (fieldErrors[f.key]) setFieldErrors(({ [f.key]: _removed, ...rest }) => rest);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        {(def.requiredDocuments.length > 0 || canUpload) && (
          <section aria-labelledby="docs-title">
            <h3 id="docs-title" className="mb-2 text-sm font-semibold">
              Documents
            </h3>
            {def.requiredDocuments.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {def.requiredDocuments.map((type) => {
                  const present = docsByType.get(type) ?? [];
                  return (
                    <li key={type} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center" data-testid={`required-doc-${type}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {present.length > 0 ? <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" aria-label="Uploaded" /> : <Circle className="size-4.5 shrink-0 text-muted-foreground" aria-label="Missing" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[type]}</p>
                          {present.length > 0 ? (
                            <div className="flex flex-wrap gap-x-3">
                              {present.slice(0, 3).map((d) => (
                                <DocumentLink key={d.id} doc={d} />
                              ))}
                              {present.length > 3 && <span className="text-xs text-muted-foreground">+{present.length - 3} more</span>}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Required</p>
                          )}
                        </div>
                      </div>
                      {canUpload && <FileUpload compact onUpload={doUpload(type)} label={present.length ? 'Add another' : 'Upload'} className="sm:max-w-[55%]" />}
                    </li>
                  );
                })}
              </ul>
            )}
            {stageDocs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {stageDocs.map((d) => (
                  <DocumentLink key={d.id} doc={d} />
                ))}
              </div>
            )}
            {canUpload && (
              <div className="mt-3 rounded-xl border border-dashed border-border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Add another document or photo to this stage</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Select
                    aria-label="Document type"
                    value={extraType}
                    onChange={(e) => setExtraType(e.target.value as DocumentType)}
                    options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))}
                    className="sm:w-52"
                  />
                  <FileUpload compact onUpload={doUpload(extraType)} label="Choose file / take photo" className="flex-1" />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Notes */}
        <section aria-labelledby="notes-title">
          <h3 id="notes-title" className="mb-2 text-sm font-semibold">
            Notes
          </h3>
          {state.notes.length > 0 && (
            <ul className="mb-3 space-y-2">
              {state.notes.map((n, i) => (
                <li key={`${n.at}-${i}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {n.by?.name} · {formatDateTime(n.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canAct && (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (saved with your next action)…" rows={2} aria-label="New note" />
          )}
        </section>
      </div>

      {/* Actions — sticky footer inside the scroll area keeps them reachable on phones */}
      {canAct && (
        <div className="sticky -bottom-4 -mx-4 flex flex-wrap gap-2 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
          {finished ? (
            canOverride && (
              <Button variant="outline" onClick={() => reopen.mutate(def.key)} loading={reopen.isPending} className="flex-1 sm:flex-none">
                <RotateCcw /> Reopen stage
              </Button>
            )
          ) : (
            <>
              {(state.status === 'pending' || (locked && canOverride)) && (
                <Button variant="outline" onClick={() => send({ status: 'in_progress', data }, 'Stage started')} disabled={busy} className="flex-1 sm:flex-none">
                  <Play /> Start
                </Button>
              )}
              {state.status === 'blocked' && (
                <Button variant="outline" onClick={() => send({ status: 'in_progress' }, 'Stage unblocked')} disabled={busy} className="flex-1 sm:flex-none">
                  <Play /> Unblock
                </Button>
              )}
              {state.status !== 'blocked' && !locked && (
                <Button variant="ghost" onClick={() => setBlockOpen(true)} disabled={busy} className="text-rose-600 dark:text-rose-400">
                  <Ban /> Block
                </Button>
              )}
              {(def.optional || canOverride) && (
                <Button variant="ghost" onClick={() => send({ status: 'skipped', note: note.trim() || undefined }, 'Stage skipped')} disabled={busy}>
                  <SkipForward /> Skip
                </Button>
              )}
              <div className="hidden flex-1 sm:block" />
              <Button variant="outline" onClick={() => send({ data }, 'Saved')} disabled={busy || !dirty} className="flex-1 sm:flex-none">
                <Save /> Save
              </Button>
              <Button onClick={complete} loading={update.isPending} disabled={busy || (locked && !canOverride)} className="flex-1 sm:flex-none" data-testid="complete-stage">
                <CheckCircle2 /> Complete
              </Button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Block this stage"
        description="Blocked stages are flagged to the project manager until unblocked."
        reason={{ label: 'Reason', required: true, placeholder: 'e.g. Customer unavailable until 15th, roof repair pending…' }}
        confirmLabel="Block stage"
        destructive
        loading={update.isPending}
        onConfirm={(reason) => {
          send({ status: 'blocked', blockedReason: reason }, 'Stage blocked');
          setBlockOpen(false);
        }}
      />
    </div>
  );
}

function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="mb-1 flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label === 'Due' && <Clock className="size-3" aria-hidden />}
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Callout({ tone, icon, title, children }: { tone: 'neutral' | 'red'; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
        tone === 'red' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {icon}
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function AssigneePicker({ value, ownerRoles, onChange, disabled }: { value: string; ownerRoles: string[]; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useUserOptions();
  const options = (data ?? [])
    .filter((u) => u.roleKey !== 'customer')
    .sort((a, b) => Number(ownerRoles.includes(b.roleKey)) - Number(ownerRoles.includes(a.roleKey)))
    .map((u) => ({ value: u.id, label: `${u.name} · ${roleShort(u.roleKey)}` }));
  return <Select aria-label="Assignee" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Unassigned" options={options} disabled={disabled} className="max-w-full" />;
}
