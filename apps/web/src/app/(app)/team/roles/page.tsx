'use client';

import { Lock, Plus, Save, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PERMISSION_GROUPS, PERMISSION_LABELS, humanize, roleSchema, type Permission } from '@solar/shared';
import { toast } from 'sonner';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '@/hooks/api/use-team';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';

export default function RolesPage() {
  return (
    <Require permission="roles:manage">
      <Roles />
    </Require>
  );
}

function Roles() {
  const { data: roles, isLoading, error, refetch } = useRoles();
  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (error || !roles) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <Matrix key={roles.map((r) => r.id + r.permissions.length).join()} roles={roles} />;
}

/** Permission matrix: rows = permissions grouped by area, columns = roles. Owner is always full access. */
function Matrix({ roles }: { roles: Role[] }) {
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() => Object.fromEntries(roles.map((r) => [r.id, new Set(r.permissions)])));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const updateRole = useUpdateRole();
  const remove = useDeleteRole();
  const ordered = useMemo(() => [...roles].sort((a, b) => Number(b.key === 'owner') - Number(a.key === 'owner') || Number(b.isSystem) - Number(a.isSystem)), [roles]);

  const changed = roles.filter((r) => {
    const d = draft[r.id];
    return d && (d.size !== r.permissions.length || r.permissions.some((p) => !d.has(p)));
  });

  const toggle = (roleId: string, perms: string[], on: boolean) =>
    setDraft((prev) => {
      const next = new Set(prev[roleId]);
      perms.forEach((p) => (on ? next.add(p) : next.delete(p)));
      return { ...prev, [roleId]: next };
    });

  const saveAll = async () => {
    setSaving(true);
    try {
      // Roles are saved one by one so a failure names the role that was rejected.
      for (const r of changed) {
        await updateRole.mutateAsync({ id: r.id, permissions: Array.from(draft[r.id] ?? []) as Permission[] });
      }
      toast.success('Permissions saved');
    } catch {
      // Error toast comes from the mutation cache; unsaved roles stay highlighted.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Tick what each role may do. Changes apply at the member&apos;s next request.</p>
        <div className="flex flex-wrap gap-2">
          {changed.length > 0 && (
            <Button variant="ghost" onClick={() => setDraft(Object.fromEntries(roles.map((r) => [r.id, new Set(r.permissions)])))}>
              <Undo2 /> Discard
            </Button>
          )}
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus /> Custom role
          </Button>
          <Button disabled={changed.length === 0} loading={saving} onClick={() => void saveAll()}>
            <Save /> Save {changed.length > 0 ? `${changed.length} role${changed.length > 1 ? 's' : ''}` : 'changes'}
          </Button>
        </div>
      </div>

      <div className="relative scrollbar-thin overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Role permission matrix</caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-20 min-w-56 bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Permission
              </th>
              {ordered.map((r) => (
                <th key={r.id} scope="col" className={cn('min-w-28 px-2 py-3 text-center align-bottom', changed.includes(r) && 'bg-accent-soft')}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs leading-tight font-semibold">{r.name}</span>
                    <span className="flex items-center gap-1">
                      {r.key === 'owner' ? (
                        <Badge tone="gold">
                          <Lock className="size-2.5" /> Locked
                        </Badge>
                      ) : r.isSystem ? (
                        <Badge>System</Badge>
                      ) : (
                        <Badge tone="purple">Custom</Badge>
                      )}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">{r.userCount} user{r.userCount === 1 ? '' : 's'}</span>
                    {!r.isSystem && (
                      <Tooltip content={r.userCount > 0 ? 'Reassign its users first' : 'Delete role'}>
                        <span>
                          <Button variant="ghost" size="icon-sm" className="size-6" disabled={r.userCount > 0} onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <GroupRows key={group} group={group} perms={perms as readonly Permission[]} roles={ordered} draft={draft} changed={changed} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>

      <CreateRoleDialog open={creating} onOpenChange={setCreating} roles={roles} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete role “${deleting?.name}”?`}
        destructive
        confirmLabel="Delete role"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}

function GroupRows({
  group,
  perms,
  roles,
  draft,
  changed,
  onToggle,
}: {
  group: string;
  perms: readonly Permission[];
  roles: Role[];
  draft: Record<string, Set<string>>;
  changed: Role[];
  onToggle: (roleId: string, perms: string[], on: boolean) => void;
}) {
  return (
    <>
      <tr className="border-b border-border bg-muted/40">
        <th scope="rowgroup" className="sticky left-0 z-10 bg-muted px-4 py-2 text-left text-xs font-semibold tracking-wide uppercase">
          {humanize(group)}
        </th>
        {roles.map((r) => {
          const set = draft[r.id] ?? new Set();
          const count = perms.filter((p) => set.has(p)).length;
          const state = count === 0 ? false : count === perms.length ? true : 'indeterminate';
          const locked = r.key === 'owner';
          return (
            <td key={r.id} className={cn('px-2 py-2 text-center', changed.includes(r) && 'bg-accent-soft/60')}>
              <Checkbox checked={locked ? true : state} disabled={locked} onCheckedChange={() => onToggle(r.id, [...perms], state !== true)} aria-label={`${r.name}: all ${group} permissions`} />
            </td>
          );
        })}
      </tr>
      {perms.map((p) => (
        <tr key={p} className="border-b border-border last:border-0 hover:bg-muted/30">
          <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
            <span className="block">{PERMISSION_LABELS[p]}</span>
            <code className="text-[10px] text-muted-foreground">{p}</code>
          </th>
          {roles.map((r) => {
            const locked = r.key === 'owner';
            return (
              <td key={r.id} className={cn('px-2 py-2 text-center', changed.includes(r) && 'bg-accent-soft/40')}>
                <Checkbox checked={locked || (draft[r.id]?.has(p) ?? false)} disabled={locked} onCheckedChange={(c) => onToggle(r.id, [p], c === true)} aria-label={`${r.name}: ${PERMISSION_LABELS[p]}`} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function CreateRoleDialog({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[] }) {
  const create = useCreateRole();
  const [v, setV] = useState({ name: '', key: '', description: '', cloneFrom: '' });
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const base = roles.find((r) => r.id === v.cloneFrom);
    const parsed = roleSchema.safeParse({ key: v.key || v.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), name: v.name, description: v.description, permissions: base?.permissions ?? ['dashboard:read'] });
    if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setV({ name: '', key: '', description: '', cloneFrom: '' });
        onOpenChange(false);
      },
    });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create custom role"
      description="Start from an existing role's permissions, then fine-tune them in the matrix."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            <ShieldCheck /> Create role
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FormField label="Name" required>
          <Input value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Site Supervisor" />
        </FormField>
        <FormField label="Key" hint="Lowercase letters, digits and underscores. Generated from the name if empty.">
          <Input value={v.key} onChange={(e) => setV((s) => ({ ...s, key: e.target.value }))} placeholder="site_supervisor" />
        </FormField>
        <FormField label="Description">
          <Input value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} />
        </FormField>
        <FormField label="Copy permissions from">
          <Select value={v.cloneFrom} onChange={(e) => setV((s) => ({ ...s, cloneFrom: e.target.value }))} placeholder="Start empty (dashboard only)" options={roles.filter((r) => r.key !== 'owner').map((r) => ({ value: r.id, label: r.name }))} />
        </FormField>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
