'use client';

import { useRouter } from 'next/navigation';
import { Copy, MapPin, MoreHorizontal, Pause, Pencil, Phone, Play, Trash2, UserPlus, XCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCustomerAccess, useDeleteProject, useUpdateProject } from '@/hooks/api/use-projects';
import { useCan } from '@/hooks/use-session';
import type { Project } from '@/lib/types';
import { formatAddress, formatINR, formatKw } from '@/lib/utils';
import { roleShort } from '@/lib/roles';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip } from '@/components/ui/tooltip';
import { PhaseBadge } from '@/components/workflow/phase-badge';

export function ProjectHeader({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const router = useRouter();
  const canWrite = useCan({ permission: 'projects:write' });
  const canDelete = useCan({ permission: 'projects:delete' });
  const canInvite = useCan({ permission: 'users:manage', feature: 'customer_portal' });
  const update = useUpdateProject(project.id);
  const remove = useDeleteProject();
  const access = useCustomerAccess(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const team = Object.entries(project.team ?? {}).filter((e): e is [string, NonNullable<(typeof e)[1]>] => !!e[1]);
  const received = project.financialSummary?.received ?? 0;
  const address = formatAddress(project.customer.address);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-xs font-semibold text-muted-foreground">{project.code}</span>
            <StatusBadge status={project.status} />
            <PhaseBadge phase={project.currentPhase} />
          </div>
          <h1 className="mt-1.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">{project.customer.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <a href={`tel:${project.customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Phone className="size-3.5" aria-hidden /> {project.customer.phone}
            </a>
            {address && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{address}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {team.length > 0 && (
            <div className="mr-1 flex -space-x-2">
              {team.map(([role, u]) => (
                <Tooltip key={role} content={`${u.name} · ${roleShort(role)}`}>
                  <span>
                    <Avatar name={u.name} />
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
          {canWrite && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
          )}
          {(canWrite || canDelete || canInvite) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canInvite && (
                  <DropdownMenuItem
                    disabled={!project.customer.email}
                    onSelect={() => access.mutate(undefined, { onSuccess: (r) => r.inviteUrl && setInviteUrl(r.inviteUrl) })}
                  >
                    <UserPlus /> {project.customerUserId ? 'Resend portal invite' : 'Give customer portal access'}
                  </DropdownMenuItem>
                )}
                {canWrite && project.status === 'active' && (
                  <DropdownMenuItem onSelect={() => update.mutate({ status: 'on_hold' })}>
                    <Pause /> Put on hold
                  </DropdownMenuItem>
                )}
                {canWrite && project.status === 'on_hold' && (
                  <DropdownMenuItem onSelect={() => update.mutate({ status: 'active' })}>
                    <Play /> Resume
                  </DropdownMenuItem>
                )}
                {canWrite && project.status !== 'cancelled' && project.status !== 'completed' && (
                  <DropdownMenuItem onSelect={() => update.mutate({ status: 'cancelled' })}>
                    <XCircle /> Cancel project
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                      <Trash2 /> Delete project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="System size" value={<span className="inline-flex items-center gap-1"><Zap className="size-4 text-amber-500" aria-hidden />{formatKw(project.systemSizeKw)}</span>} />
        <Kpi label="Contract value" value={formatINR(project.contractValue)} />
        <Kpi label="Received" value={formatINR(received)} sub={project.contractValue ? `${Math.round((received / project.contractValue) * 100)}% collected` : undefined} />
        <Kpi label="Pending" value={formatINR(project.financialSummary?.pending ?? Math.max(0, project.contractValue - received))} />
      </dl>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium">Workflow progress</span>
          <span className="tabular text-muted-foreground">{project.progress}%</span>
        </div>
        <Progress value={project.progress} label="Workflow progress" />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${project.code}?`}
        description="The project is archived and hidden from lists. An admin can restore it from the audit log."
        confirmLabel="Delete project"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate(project.id, { onSuccess: () => router.push('/projects') })}
      />
      <Dialog open={!!inviteUrl} onOpenChange={(o) => !o && setInviteUrl(null)} title="Customer portal invite" description="Share this link with the customer (WhatsApp / SMS). It lets them set a password.">
        <div className="flex gap-2">
          <Input readOnly value={inviteUrl ?? ''} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(inviteUrl ?? '');
              toast.success('Link copied');
            }}
          >
            <Copy /> Copy
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-base font-semibold sm:text-lg">{value}</dd>
      {sub && <dd className="text-[11px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}
