'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { usePlatformFeatures, useUpdatePlatformFeature } from '@/hooks/api/use-platform';
import type { PlatformFeature } from '@/lib/types';
import { FEATURE_ICONS } from '@/components/marketing/feature-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function FeatureCataloguePage() {
  const { data, isLoading, error, refetch } = usePlatformFeatures();
  return (
    <>
      <PageHeader title="Feature catalogue" description="Platform-wide modules and their default state for tenants without an override." />
      {isLoading && <Skeleton className="h-96 rounded-xl" />}
      {error != null && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && (
        <Card className="divide-y divide-border">
          {data.map((f) => (
            <FeatureRow key={f.key} feature={f} />
          ))}
        </Card>
      )}
    </>
  );
}

function FeatureRow({ feature }: { feature: PlatformFeature }) {
  const update = useUpdatePlatformFeature();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ name: feature.name, description: feature.description });
  const Icon = FEATURE_ICONS[feature.key];
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{Icon && <Icon className="size-4.5" aria-hidden />}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <Input aria-label="Feature name" value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} />
            <Textarea aria-label="Feature description" rows={2} value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ key: feature.key, ...v }, { onSuccess: () => setEditing(false) })}>
                <Check /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setV({ name: feature.name, description: feature.description });
                  setEditing(false);
                }}
              >
                <X /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {feature.name} <Badge>{feature.category}</Badge>
              <code className="text-[11px] font-normal text-muted-foreground">{feature.key}</code>
            </p>
            <p className="text-xs text-muted-foreground">{feature.description}</p>
          </>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${feature.name}`} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Default
            <Switch checked={feature.defaultEnabled} disabled={update.isPending} onCheckedChange={(c) => update.mutate({ key: feature.key, defaultEnabled: c })} />
          </label>
        </div>
      )}
    </div>
  );
}
