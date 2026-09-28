'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuotation, useSaveQuotation } from '@/hooks/api/use-quotations';
import { toDateInputValue } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { QuotationBuilder } from '@/components/quotations/quotation-builder';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function EditQuotationPage() {
  return (
    <Require permission="quotations:write" feature="quotations">
      <EditQuotation />
    </Require>
  );
}

function EditQuotation() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: q, isLoading, error } = useQuotation(id);
  const save = useSaveQuotation(id);
  if (isLoading) return <PageSkeleton cards={0} />;
  if (error || !q) return <ErrorState error={error} />;
  if (q.status !== 'draft') {
    return <EmptyState title="Only drafts can be edited" description="Create a new version instead — sent quotations are kept for the record." action={<ButtonLink href={`/quotations/${q.id}`}>View quotation</ButtonLink>} />;
  }
  return (
    <>
      <PageHeader title={`Edit ${q.number}`} breadcrumbs={[{ label: 'Quotations', href: '/quotations' }, { label: q.number, href: `/quotations/${q.id}` }, { label: 'Edit' }]} />
      <QuotationBuilder
        submitLabel="Save quotation"
        submitting={save.isPending}
        defaultValues={{
          projectId: q.projectId,
          leadId: q.leadId,
          kind: q.kind,
          systemSizeKw: q.systemSizeKw,
          lines: q.lines,
          discount: q.discount,
          validUntil: toDateInputValue(q.validUntil) || undefined,
          terms: q.terms ?? '',
          notes: q.notes ?? '',
        }}
        onSubmit={(v) => save.mutate(v, { onSuccess: () => router.push(`/quotations/${id}`) })}
      />
    </>
  );
}
