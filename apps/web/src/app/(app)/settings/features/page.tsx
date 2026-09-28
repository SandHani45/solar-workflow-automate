'use client';

import { Lock } from 'lucide-react';
import type { FeatureDefinition } from '@solar/shared';
import { useOrgFeatures, useUpdateOrgFeature } from '@/hooks/api/use-org';
import { useRoles } from '@/hooks/api/use-team';
import type { OrgFeature } from '@/lib/types';
import { Require } from '@/components/auth/require';
import { FEATURE_ICONS } from '@/components/marketing/feature-icons';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';

const CATEGORY: Record<FeatureDefinition['category'], string> = { sales: 'Sales', operations: 'Operations', finance: 'Finance', service: 'Service', platform: 'Platform' };

export default function FeaturesPage() {
  return (
    <Require permission="features:manage">
      <Features />
    </Require>
  );
}

function Features() {
  const { data, isLoading, error, refetch } = useOrgFeatures();
  const { data: roles } = useRoles();
  const update = useUpdateOrgFeature();
  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const roleOptions = (roles ?? []).filter((r) => r.key !== 'owner').map((r) => ({ value: r.key, label: r.name }));
  const set = (f: OrgFeature, patch: Partial<Pick<OrgFeature, 'enabled' | 'roles'>>) => update.mutate({ key: f.key, enabled: patch.enabled ?? f.enabled, roles: patch.roles ?? f.roles });

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Turn modules on or off for your organisation, and optionally restrict a module to certain roles (owners always have access). Modules locked by the platform depend on your plan.
      </p>
      {(Object.keys(CATEGORY) as FeatureDefinition['category'][]).map((cat) => {
        const items = data.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {CATEGORY[cat]}
            </h2>
            <Card className="divide-y divide-border">
              {items.map((f) => {
                const Icon = FEATURE_ICONS[f.key];
                const locked = f.lockedByPlatform && !f.enabled;
                return (
                  <div key={f.key} className="grid gap-3 p-4 sm:grid-cols-[1fr_260px_auto] sm:items-center">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {f.name}
                          {f.lockedByPlatform && (
                            <Badge tone="gold">
                              <Lock className="size-2.5" /> Platform-locked
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                    <MultiSelect
                      value={f.roles ?? []}
                      onChange={(roles) => set(f, { roles })}
                      options={roleOptions}
                      placeholder="All roles"
                      disabled={!f.enabled || update.isPending}
                    />
                    <Tooltip content={locked ? 'Not included in your plan — contact SolarFlow to enable' : undefined}>
                      <span className="justify-self-end">
                        <Switch checked={f.enabled} disabled={locked || update.isPending} onCheckedChange={(enabled) => set(f, { enabled })} aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.name}`} />
                      </span>
                    </Tooltip>
                  </div>
                );
              })}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
