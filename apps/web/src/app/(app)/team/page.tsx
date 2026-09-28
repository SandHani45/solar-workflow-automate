'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, MoreHorizontal, Pencil, Power, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { inviteUserSchema, type InviteUserInput } from '@solar/shared';
import type { z } from 'zod';
import { useInviteUser, useRoles, useUpdateUser, useUsers } from '@/hooks/api/use-team';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan, useSession } from '@/hooks/use-session';
import type { User } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import { roleName } from '@/lib/roles';
import { Require } from '@/components/auth/require';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function TeamPage() {
  return (
    <Require permission="users:read">
      <Team />
    </Require>
  );
}

function Team() {
  const session = useSession();
  const canManage = useCan({ permission: 'users:manage' });
  const [params, setParams] = useQueryParams();
  const filters = { q: params.get('q') ?? '', roleKey: params.get('roleKey') ?? '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = useUsers({ ...filters, limit: 25 });
  const { data: roles } = useRoles();
  const update = useUpdateUser();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const roleLabel = (key: string) => roles?.find((r) => r.key === key)?.name ?? roleName(key);

  const columns: Column<User>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (u) => u.name,
      cell: (u) => (
        <span className="flex items-center gap-3">
          <Avatar name={u.name} />
          <span className="min-w-0">
            <span className="block font-medium">
              {u.name} {u.id === session.user.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
          </span>
        </span>
      ),
    },
    { id: 'role', header: 'Role', cell: (u) => <Badge tone={u.roleKey === 'owner' ? 'gold' : u.roleKey === 'customer' ? 'teal' : 'blue'}>{roleLabel(u.roleKey)}</Badge>, sortValue: (u) => u.roleKey },
    { id: 'phone', header: 'Phone', cell: (u) => u.phone ?? '—', hideOnMobile: true },
    { id: 'lastLoginAt', header: 'Last active', cell: (u) => (u.lastLoginAt ? formatRelative(u.lastLoginAt) : <span className="text-muted-foreground">Invited</span>), hideOnMobile: true },
    { id: 'status', header: 'Status', cell: (u) => <Badge tone={u.isActive ? 'green' : 'neutral'} dot>{u.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (u: User) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} disabled={u.id === session.user.id}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setEditing(u)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => update.mutate({ id: u.id, isActive: !u.isActive })} destructive={u.isActive}>
                    <Power /> {u.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search name or email…" />
        <Select aria-label="Role" className="sm:w-52" placeholder="All roles" value={filters.roleKey} onChange={(e) => setParams({ roleKey: e.target.value, page: null })} options={(roles ?? []).map((r) => ({ value: r.key, label: r.name }))} />
        {canManage && (
          <Button className="sm:ml-auto" onClick={() => setInviting(true)}>
            <UserPlus /> Invite member
          </Button>
        )}
      </div>
      <DataTable caption="Team members" columns={columns} data={data?.data} rowKey={(u) => u.id} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} empty={<EmptyState icon={Users} title="No team members found" />} />
      <InviteDialog open={inviting} onOpenChange={setInviting} />
      {editing && <EditUserDialog user={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useInviteUser();
  const { data: roles } = useRoles();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [setPassword, setSetPassword] = useState(false);
  const form = useForm<z.input<typeof inviteUserSchema>, unknown, InviteUserInput>({ resolver: zodResolver(inviteUserSchema), defaultValues: { name: '', email: '', roleKey: 'sales' } });
  const { errors } = form.formState;
  const close = () => {
    onOpenChange(false);
    setInviteUrl(null);
    form.reset();
  };
  const submit = form.handleSubmit((v) =>
    invite.mutate(setPassword ? v : { ...v, password: undefined }, {
      onSuccess: (r) => {
        if (r.inviteUrl) setInviteUrl(r.inviteUrl);
        else {
          toast.success(`${r.user.name} added`);
          close();
        }
      },
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={inviteUrl ? 'Invitation created' : 'Invite a team member'}
      description={inviteUrl ? 'Share this link — it lets them set their password and join.' : 'They get an invite link to set a password, or you can set one now.'}
      footer={
        inviteUrl ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} loading={invite.isPending}>
              Send invite
            </Button>
          </>
        )
      }
    >
      {inviteUrl ? (
        <div className="flex gap-2">
          <Input readOnly value={inviteUrl} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} data-testid="invite-url" />
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(inviteUrl);
              toast.success('Invite link copied');
            }}
          >
            <Copy /> Copy
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Name" error={errors.name} required>
            <Input {...form.register('name')} />
          </FormField>
          <FormField label="Email" error={errors.email} required>
            <Input type="email" {...form.register('email')} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <Input type="tel" {...form.register('phone', { setValueAs: (v) => (v === '' ? undefined : v) })} />
          </FormField>
          <FormField label="Role" error={errors.roleKey}>
            <Select options={(roles ?? []).filter((r) => r.key !== 'customer').map((r) => ({ value: r.key, label: r.name }))} {...form.register('roleKey')} />
          </FormField>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm sm:col-span-2">
            Set a password now instead of sending an invite link
            <Switch checked={setPassword} onCheckedChange={setSetPassword} />
          </label>
          {setPassword && (
            <FormField label="Password" error={errors.password} className="sm:col-span-2">
              <Input type="password" autoComplete="new-password" {...form.register('password', { setValueAs: (v) => (v === '' ? undefined : v) })} />
            </FormField>
          )}
        </form>
      )}
    </Dialog>
  );
}

function EditUserDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const update = useUpdateUser();
  const { data: roles } = useRoles();
  const [v, setV] = useState({ name: user.name, phone: user.phone ?? '', roleKey: user.roleKey });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${user.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={update.isPending} onClick={() => update.mutate({ id: user.id, name: v.name, phone: v.phone || undefined, roleKey: v.roleKey }, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FormField label="Name">
          <Input value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} />
        </FormField>
        <FormField label="Phone">
          <Input type="tel" value={v.phone} onChange={(e) => setV((s) => ({ ...s, phone: e.target.value }))} />
        </FormField>
        <FormField label="Role" hint="The last owner can't be demoted.">
          <Select value={v.roleKey} onChange={(e) => setV((s) => ({ ...s, roleKey: e.target.value }))} options={(roles ?? []).map((r) => ({ value: r.key, label: r.name }))} />
        </FormField>
      </div>
    </Dialog>
  );
}
