import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ListMeta } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { Button } from './button';

export function Pagination({ meta, onPageChange }: { meta: ListMeta; onPageChange: (page: number) => void }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-1 py-3 text-xs text-muted-foreground">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(meta.total)}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="tabular px-1.5">
          {meta.page} / {Math.max(1, meta.pages)}
        </span>
        <Button variant="outline" size="icon-sm" disabled={meta.page >= meta.pages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
