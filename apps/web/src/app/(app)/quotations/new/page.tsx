'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useLead } from '@/hooks/api/use-leads';
import { useProject } from '@/hooks/api/use-projects';
import { useSaveQuotation } from '@/hooks/api/use-quotations';
import { addDays } from 'date-fns';
import { toDateInputValue } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { ProjectPicker } from '@/components/projects/project-picker';
import { DEFAULT_TERMS, QuotationBuilder } from '@/components/quotations/quotation-builder';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function NewQuotationPage() {
  return (
    <Require permission="quotations:write" feature="quotations">
      <NewQuotation />
    </Require>
  );
}

function NewQuotation() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get('projectId') ?? '';
  const leadId = params.get('leadId') ?? '';
  const project = useProject(projectId);
  const lead = useLead(leadId);
  const save = useSaveQuotation();

  if ((projectId && project.isLoading) || (leadId && lead.isLoading)) return <PageSkeleton cards={0} />;

  const customer = project.data?.customer.name ?? lead.data?.name;
  const kw = project.data?.systemSizeKw ?? lead.data?.requiredKw ?? '';

  return (
    <>
      <PageHeader
        title="New quotation"
        description={customer ? `For ${customer}${project.data ? ` · ${project.data.code}` : lead.data ? ` · ${lead.data.code}` : ''}` : 'Pick the project this quotation is for.'}
        breadcrumbs={[{ label: 'Quotations', href: '/quotations' }, { label: 'New' }]}
      />
      {!projectId && !leadId ? (
        <Card className="max-w-lg">
          <CardContent>
            <FormField label="Project" htmlFor="q-project">
              <ProjectPicker id="q-project" onChange={(p) => router.replace(`/quotations/new?projectId=${p.id}`)} />
            </FormField>
          </CardContent>
        </Card>
      ) : (
        <QuotationBuilder
          key={`${projectId}-${leadId}`}
          submitLabel="Create quotation"
          submitting={save.isPending}
          defaultValues={{
            projectId: projectId || undefined,
            leadId: leadId || undefined,
            kind: project.data && project.data.currentPhase !== 'sales' ? 'final' : 'initial',
            systemSizeKw: kw,
            lines: [],
            discount: 0,
            validUntil: toDateInputValue(addDays(new Date(), 15)),
            terms: DEFAULT_TERMS,
            notes: '',
          }}
          onSubmit={(v) => save.mutate(v, { onSuccess: (q) => router.push(`/quotations/${q.id}`) })}
        />
      )}
    </>
  );
}
