'use client';

import { ArrowDownToLine, ArrowUpFromLine, Boxes, MoreHorizontal, Pencil, Plus, SlidersHorizontal, Archive } from 'lucide-react';
import { useState } from 'react';
import { humanize, ITEM_CATEGORIES, type StockMovementType } from '@solar/shared';
import { useArchiveItem, useItems } from '@/hooks/api/use-inventory';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import type { InventoryItem } from '@/lib/types';
import { formatINR, formatNumber } from '@/lib/utils';
import { ItemDialog } from '@/components/inventory/item-dialog';
import { MovementDialog } from '@/components/inventory/movement-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';

export default function InventoryItemsPage() {
  const canWrite = useCan({ permission: 'inventory:write' });
  const canAdjust = useCan({ permission: 'inventory:adjust' });
  const [params, setParams] = useQueryParams();
  const filters = { q: params.get('q') ?? '', category: params.get('category') ?? '', lowStock: params.get('lowStock') === 'true' ? 'true' : '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = useItems({ ...filters, limit: 25 });
  const archive = useArchiveItem();
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [moving, setMoving] = useState<{ item: InventoryItem; type: StockMovementType } | null>(null);
  const [archiving, setArchiving] = useState<InventoryItem | null>(null);

  const columns: Column<InventoryItem>[] = [
    {
      id: 'name',
      header: 'Item',
      sortValue: (i) => i.name,
      cell: (i) => (
        <div className="max-w-72">
          <p className="truncate font-medium">{i.name}</p>
          <p className="text-xs text-muted-foreground">
            {i.sku}
            {i.brand ? ` · ${i.brand}` : ''}
          </p>
        </div>
      ),
    },
    { id: 'category', header: 'Category', cell: (i) => humanize(i.category), hideOnMobile: true },
    {
      id: 'quantity',
      header: 'In stock',
      align: 'right',
      sortValue: (i) => i.quantity,
      cell: (i) => (
        <span className="inline-flex items-center gap-2">
          {i.available <= i.reorderLevel && <Badge tone="red">Low</Badge>}
          <span className="tabular font-medium">{formatNumber(i.quantity)}</span>
          <span className="text-xs text-muted-foreground">{i.unit}</span>
        </span>
      ),
    },
    { id: 'reserved', header: 'Reserved', align: 'right', sortValue: (i) => i.reserved, cell: (i) => <span className="tabular text-muted-foreground">{formatNumber(i.reserved)}</span>, hideOnMobile: true },
    { id: 'available', header: 'Available', align: 'right', sortValue: (i) => i.available, cell: (i) => <span className="tabular">{formatNumber(i.available)}</span> },
    { id: 'costPrice', header: 'Avg cost', align: 'right', sortValue: (i) => i.costPrice, cell: (i) => <span className="tabular">{formatINR(i.costPrice)}</span>, hideOnMobile: true },
    { id: 'stockValue', header: 'Value', align: 'right', sortValue: (i) => i.stockValue, cell: (i) => <span className="tabular font-medium">{formatINR(i.stockValue)}</span> },
    ...(canWrite || canAdjust
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (i: InventoryItem) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {canWrite && (
                    <DropdownMenuItem onSelect={() => setMoving({ item: i, type: 'in' })}>
                      <ArrowDownToLine /> Stock in
                    </DropdownMenuItem>
                  )}
                  {canAdjust && (
                    <>
                      <DropdownMenuItem onSelect={() => setMoving({ item: i, type: 'out' })}>
                        <ArrowUpFromLine /> Stock out
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setMoving({ item: i, type: 'adjust' })}>
                        <SlidersHorizontal /> Adjust
                      </DropdownMenuItem>
                    </>
                  )}
                  {canWrite && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setEditing(i)}>
                        <Pencil /> Edit item
                      </DropdownMenuItem>
                      <DropdownMenuItem destructive onSelect={() => setArchiving(i)}>
                        <Archive /> Archive
                      </DropdownMenuItem>
                    </>
                  )}
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
        <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search item or SKU…" />
        <Select aria-label="Category" className="sm:w-44" placeholder="All categories" value={filters.category} onChange={(e) => setParams({ category: e.target.value, page: null })} options={ITEM_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={filters.lowStock === 'true'} onCheckedChange={(c) => setParams({ lowStock: c === true ? 'true' : null, page: null })} />
          Low stock only
        </label>
        {canWrite && (
          <Button className="sm:ml-auto" onClick={() => setEditing('new')}>
            <Plus /> Add item
          </Button>
        )}
      </div>
      <DataTable
        caption="Inventory items"
        columns={columns}
        data={data?.data}
        rowKey={(i) => i.id}
        loading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={(p) => setParams({ page: String(p) })}
        rowClassName={(i) => (i.available <= i.reorderLevel ? 'bg-rose-50/40 dark:bg-rose-500/5' : undefined)}
        empty={<EmptyState icon={Boxes} title="No items" description="Add modules, inverters, structures and BOS items to start tracking stock." />}
      />
      {editing && <ItemDialog open onOpenChange={(o) => !o && setEditing(null)} item={editing === 'new' ? undefined : editing} />}
      <MovementDialog item={moving?.item ?? null} initialType={moving?.type} onOpenChange={(o) => !o && setMoving(null)} />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name}?`}
        description="Archived items are hidden from pickers; history is kept."
        confirmLabel="Archive"
        destructive
        loading={archive.isPending}
        onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })}
      />
    </>
  );
}
