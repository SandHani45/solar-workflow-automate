'use client';

import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useSaveBoq } from '@/hooks/api/use-projects';
import { useCan } from '@/hooks/use-session';
import type { BoqLine, Project } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { ItemPicker } from '@/components/inventory/item-picker';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Row = BoqLine & { rowId: string };
const toRows = (lines: BoqLine[]): Row[] => lines.map((l, i) => ({ ...l, rowId: `${l.itemId ?? 'free'}-${i}` }));
let seq = 0;

/** Editable Bill of Quantities. Lines picked from inventory keep `itemId` so stock can be reserved and dispatched. */
export function BoqTab({ project }: { project: Project }) {
  const canEdit = useCan({ permission: 'projects:write' });
  const canPickStock = useCan({ permission: 'inventory:read', feature: 'inventory' });
  const save = useSaveBoq(project.id);
  const [rows, setRows] = useState<Row[]>(() => toRows(project.boq ?? []));
  const dirty = JSON.stringify(rows.map(({ rowId: _r, ...l }) => l)) !== JSON.stringify(project.boq ?? []);
  const total = rows.reduce((s, r) => s + r.quantity * r.unitCost, 0);

  const patch = (rowId: string, p: Partial<BoqLine>) => setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...p } : r)));
  const add = (line: BoqLine) => setRows((rs) => [...rs, { ...line, rowId: `new-${++seq}` }]);

  return (
    <Card>
      <CardHeader
        title="Bill of quantities"
        description={`${rows.length} line${rows.length === 1 ? '' : 's'} · material cost ${formatINR(total)}`}
        action={
          canEdit && (
            <>
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setRows(toRows(project.boq ?? []))}>
                  <Undo2 /> Discard
                </Button>
              )}
              <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ items: rows.filter((r) => r.description.trim()).map(({ rowId: _r, ...l }) => l) })}>
                <Save /> Save BOQ
              </Button>
            </>
          )
        }
      />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="w-24 px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-2 py-2 text-left font-medium">Unit</th>
              <th className="w-36 px-2 py-2 text-right font-medium">Unit cost</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Amount</th>
              {canEdit && <th className="w-12 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No BOQ lines yet. Add modules, inverter, structure and BOS below.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.rowId} className="border-t border-border">
                <td className="px-4 py-1.5">
                  {canEdit ? <Input className="h-8" aria-label="Description" value={r.description} onChange={(e) => patch(r.rowId, { description: e.target.value })} /> : r.description}
                  {r.itemId && <span className="mt-0.5 block text-[10px] text-emerald-600 dark:text-emerald-400">Linked to inventory</span>}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {canEdit ? <Input className="h-8 text-right" type="number" min={0} aria-label="Quantity" value={r.quantity} onChange={(e) => patch(r.rowId, { quantity: Number(e.target.value) })} /> : r.quantity}
                </td>
                <td className="px-2 py-1.5">{canEdit ? <Input className="h-8" aria-label="Unit" value={r.unit} onChange={(e) => patch(r.rowId, { unit: e.target.value })} /> : r.unit}</td>
                <td className="px-2 py-1.5 text-right">
                  {canEdit ? <Input className="h-8 text-right" type="number" min={0} aria-label="Unit cost" value={r.unitCost} onChange={(e) => patch(r.rowId, { unitCost: Number(e.target.value) })} /> : formatINR(r.unitCost)}
                </td>
                <td className="tabular px-2 py-1.5 text-right font-medium">{formatINR(r.quantity * r.unitCost)}</td>
                {canEdit && (
                  <td className="px-2 py-1.5">
                    <Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((x) => x.rowId !== r.rowId))}>
                      <Trash2 />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 font-semibold">
              <td className="px-4 py-2.5" colSpan={4}>
                Total material cost
              </td>
              <td className="tabular px-2 py-2.5 text-right">{formatINR(total)}</td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
          {canPickStock && (
            <ItemPicker className="sm:max-w-sm" onPick={(i) => add({ itemId: i.id, description: i.name, quantity: 1, unit: i.unit, unitCost: i.costPrice })} />
          )}
          <Button variant="outline" onClick={() => add({ description: '', quantity: 1, unit: 'nos', unitCost: 0 })}>
            <Plus /> Add custom line
          </Button>
        </div>
      )}
    </Card>
  );
}
