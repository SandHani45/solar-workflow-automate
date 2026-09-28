'use client';

import { Handshake, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { partnersShareValid, type Partner } from '@solar/shared';
import { usePartners, useSavePartners } from '@/hooks/api/use-finance';
import { cn } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnersPage() {
  return (
    <Require permission="finance:partners" feature="partner_profit_split">
      <Partners />
    </Require>
  );
}

function Partners() {
  const { data, isLoading, error } = usePartners();
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (error) return <ErrorState error={error} />;
  return <PartnersEditor initial={data ?? []} />;
}

function PartnersEditor({ initial }: { initial: Partner[] }) {
  const save = useSavePartners();
  const [rows, setRows] = useState<Partner[]>(initial);
  const total = rows.reduce((s, p) => s + (Number(p.sharePercent) || 0), 0);
  const valid = partnersShareValid(rows) && rows.every((r) => r.name.trim());
  const patch = (i: number, p: Partial<Partner>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Partners" description="Profit is split by share %, then each partner's outstanding advances are deducted." />
      <CardContent className="space-y-3">
        {rows.length === 0 && <EmptyState compact icon={Handshake} title="No partners yet" description="Add the business partners and their profit share." />}
        {rows.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label="Partner name" placeholder="Partner name" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} className="flex-1" />
            <div className="relative w-28">
              <Input aria-label="Share percent" type="number" min={0} max={100} step="0.01" className="pr-7 text-right" value={p.sharePercent} onChange={(e) => patch(i, { sharePercent: Number(e.target.value) })} />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove partner" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, { name: '', sharePercent: Math.max(0, 100 - total) }])}>
            <Plus /> Add partner
          </Button>
          <p className={cn('tabular text-sm', rows.length > 0 && Math.abs(total - 100) > 0.01 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>Total {total}% {rows.length > 0 && Math.abs(total - 100) > 0.01 && '— must equal 100%'}</p>
          <Button onClick={() => save.mutate(rows.map((r) => ({ ...r, name: r.name.trim() })))} disabled={!valid} loading={save.isPending}>
            <Save /> Save partners
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
