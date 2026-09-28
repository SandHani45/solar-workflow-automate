'use client';

import { PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { dispatchSchema } from '@solar/shared';
import { useCreateDispatch } from '@/hooks/api/use-inventory';
import { useProject } from '@/hooks/api/use-projects';
import { toDateInputValue } from '@/lib/utils';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

/** Plan a dispatch from the project's BOQ (only lines linked to inventory items can be dispatched). */
export function DispatchDialog({ open, onOpenChange, projectId: fixedProjectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string }) {
  const [projectId, setProjectId] = useState(fixedProjectId ?? '');
  const project = useProject(projectId);
  const create = useCreateDispatch();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ scheduledDate: toDateInputValue(new Date()), vehicleNo: '', driverName: '', driverPhone: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  const lines = (project.data?.boq ?? []).filter((l): l is typeof l & { itemId: string } => !!l.itemId);

  const submit = () => {
    const items = lines.filter((l) => selected[l.itemId] ?? true).map((l) => ({ itemId: l.itemId, quantity: qty[l.itemId] ?? l.quantity }));
    const parsed = dispatchSchema.safeParse({
      projectId,
      items,
      scheduledDate: form.scheduledDate,
      vehicleNo: form.vehicleNo || undefined,
      driverName: form.driverName || undefined,
      driverPhone: form.driverPhone || undefined,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setError(null);
    create.mutate(parsed.data, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Plan dispatch"
      description="Stock is issued to the project when the dispatch goes in transit."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!projectId || lines.length === 0}>
            Create dispatch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedProjectId && (
          <FormField label="Project" required htmlFor="dp-project">
            <ProjectPicker id="dp-project" value={projectId} onChange={(p) => setProjectId(p.id)} />
          </FormField>
        )}
        {projectId && project.isLoading && <Skeleton className="h-32" />}
        {projectId && project.data && lines.length === 0 && (
          <EmptyState compact icon={PackageOpen} title="No BOQ items linked to inventory" description="Add BOQ lines from the inventory picker on the project's BOQ tab first." />
        )}
        {lines.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.itemId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Checkbox aria-label={`Include ${l.description}`} checked={selected[l.itemId] ?? true} onCheckedChange={(c) => setSelected((s) => ({ ...s, [l.itemId]: c === true }))} />
                    </td>
                    <td className="px-3 py-2">
                      {l.description} <span className="text-xs text-muted-foreground">({l.unit})</span>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} className="h-8 text-right" aria-label={`Quantity for ${l.description}`} value={qty[l.itemId] ?? l.quantity} onChange={(e) => setQty((q) => ({ ...q, [l.itemId]: Number(e.target.value) }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Dispatch date" required>
            <DateInput value={form.scheduledDate} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
          </FormField>
          <FormField label="Vehicle number">
            <Input value={form.vehicleNo} onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))} placeholder="RJ14 AB 1234" />
          </FormField>
          <FormField label="Driver name">
            <Input value={form.driverName} onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))} />
          </FormField>
          <FormField label="Driver phone">
            <Input type="tel" value={form.driverPhone} onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))} />
          </FormField>
          <FormField label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </FormField>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
