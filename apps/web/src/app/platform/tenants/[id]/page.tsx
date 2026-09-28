'use client';

import { useParams } from 'next/navigation';
import { Lock, LockOpen, Power } from 'lucide-react';
import { useState } from 'react';
import { FEATURE_CATALOGUE, humanize, isFeatureEnabled, ORG_PLANS, type FeatureKey, type OrgFeatureOverride, type OrgPlan } from '@solar/shared';
import { usePlatformFeatures, usePlatformOrg, useUpdatePlatformOrg } from '@/hooks/api/use-platform';
import type { PlatformOrg } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = usePlatformOrg(id);
  if (isLoading) return <PageSkeleton cards={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <Tenant org={data} />;
}

function Tenant({ org }: { org: PlatformOrg }) {
  const update = useUpdatePlatformOrg(org.id);
  const { data: catalogue } = usePlatformFeatures();
  const [suspending, setSuspending] = useState(false);
  const overrides = org.features ?? {};
  const defs = catalogue ?? FEATURE_CATALOGUE;

  /** Send the full override map: PATCH replaces `features` for the keys given. */
  const setOverride = (key: FeatureKey, next: OrgFeatureOverride | null) => {
    const features: Record<string, OrgFeatureOverride> = { ...(overrides as Record<string, OrgFeatureOverride>) };
    if (next) features[key] = next;
    else delete features[key];
    update.mutate({ features });
  };

  return (
    <>
      <PageHeader
        title={org.name}
        description={`${org.slug} · joined ${formatDate(org.createdAt)} · ${formatNumber(org.users)} users · ${formatNumber(org.projects)} projects`}
        breadcrumbs={[{ label: 'Tenants', href: '/platform/tenants' }, { label: org.name }]}
        actions={
          org.isActive ? (
            <Button variant="outline" className="text-rose-600" onClick={() => setSuspending(true)}>
              <Power /> Suspend
            </Button>
          ) : (
            <Button onClick={() => update.mutate({ isActive: true })} loading={update.isPending}>
              <Power /> Reactivate
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardHeader title="Subscription" />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={org.isActive ? 'active' : 'cancelled'} label={org.isActive ? 'Active' : 'Suspended'} size="md" />
              <StatusBadge status={org.plan} size="md" />
            </div>
            <FormField label="Plan">
              <Select value={org.plan} onChange={(e) => update.mutate({ plan: e.target.value as OrgPlan })} options={ORG_PLANS.map((p) => ({ value: p, label: humanize(p) }))} disabled={update.isPending} />
            </FormField>
            {org.settings?.gstin && <p className="text-xs text-muted-foreground">GSTIN {org.settings.gstin}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Feature entitlements" description="Override the platform default for this tenant. Locked features can't be re-enabled by the tenant's admin." />
          <ul className="divide-y divide-border">
            {defs.map((f) => {
              const o = overrides[f.key];
              const effective = isFeatureEnabled(f.key, overrides, undefined, defs);
              return (
                <li key={f.key} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {f.name}
                      {o ? <Badge tone="purple">Override</Badge> : <Badge>Default {f.defaultEnabled ? 'on' : 'off'}</Badge>}
                      {o?.lockedByPlatform && (
                        <Badge tone="gold">
                          <Lock className="size-2.5" /> Locked
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{f.description}</p>
                  </div>
                  {o && (
                    <Button variant="ghost" size="sm" onClick={() => setOverride(f.key, null)} disabled={update.isPending}>
                      Use default
                    </Button>
                  )}
                  <Tooltip content={o?.lockedByPlatform ? 'Unlock' : 'Lock (tenant admin cannot enable)'}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${o?.lockedByPlatform ? 'Unlock' : 'Lock'} ${f.name}`}
                      disabled={update.isPending}
                      onClick={() => setOverride(f.key, { enabled: effective, roles: o?.roles, lockedByPlatform: !o?.lockedByPlatform })}
                    >
                      {o?.lockedByPlatform ? <Lock /> : <LockOpen />}
                    </Button>
                  </Tooltip>
                  <Switch checked={effective} disabled={update.isPending} onCheckedChange={(c) => setOverride(f.key, { enabled: c, roles: o?.roles, lockedByPlatform: o?.lockedByPlatform })} aria-label={`${effective ? 'Disable' : 'Enable'} ${f.name}`} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <ConfirmDialog
        open={suspending}
        onOpenChange={setSuspending}
        title={`Suspend ${org.name}?`}
        description="Users of this organisation will be signed out and unable to log in until reactivated. Data is kept."
        destructive
        confirmLabel="Suspend tenant"
        loading={update.isPending}
        onConfirm={() => update.mutate({ isActive: false }, { onSuccess: () => setSuspending(false) })}
      />
    </>
  );
}
