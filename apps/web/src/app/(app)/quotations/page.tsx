'use client';

import { Plus } from 'lucide-react';
import { humanize, QUOTATION_STATUSES } from '@solar/shared';
import { useQuotations } from '@/hooks/api/use-quotations';
import { useQueryParams } from '@/hooks/use-query-state';
import { useCan } from '@/hooks/use-session';
import { Require } from '@/components/auth/require';
import { QuotationTable } from '@/components/quotations/quotation-table';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';

export default function QuotationsPage() {
  return (
    <Require permission="quotations:read" feature="quotations">
      <Quotations />
    </Require>
  );
}

function Quotations() {
  const canWrite = useCan({ permission: 'quotations:write' });
  const [params, setParams] = useQueryParams();
  const filters = { q: params.get('q') ?? '', status: params.get('status') ?? '', page: Number(params.get('page') ?? 1) };
  const { data, isLoading, error } = useQuotations({ ...filters, limit: 20, sort: '-createdAt' });
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Versioned quotations with GST — send, accept and print."
        actions={
          canWrite && (
            <ButtonLink href="/quotations/new">
              <Plus /> New quotation
            </ButtonLink>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={filters.q} onChange={(q) => setParams({ q, page: null })} placeholder="Search number or customer…" />
        <Select aria-label="Status" className="sm:w-44" placeholder="All statuses" value={filters.status} onChange={(e) => setParams({ status: e.target.value, page: null })} options={QUOTATION_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
      </div>
      <QuotationTable data={data?.data} loading={isLoading} error={error} meta={data?.meta} onPageChange={(p) => setParams({ page: String(p) })} />
    </>
  );
}
