'use client';

import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/api/use-projects';
import { Require } from '@/components/auth/require';
import { ProjectForm } from '@/components/projects/project-form';
import { PageHeader } from '@/components/ui/page-header';

export default function NewProjectPage() {
  const router = useRouter();
  const create = useCreateProject();
  return (
    <Require permission="projects:write">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="New project"
          description="The project starts at stage 1 of your organisation's current workflow."
          breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New' }]}
        />
        <ProjectForm
          submitLabel="Create project"
          submitting={create.isPending}
          defaultValues={{
            customer: { name: '', phone: '', email: '', address: { line1: '', city: '', district: '', state: '', pincode: '' } },
            customerType: 'residential',
            connectionType: 'on_grid',
            systemSizeKw: '',
            contractValue: '',
          }}
          onSubmit={(v) => create.mutate(v, { onSuccess: (p) => router.push(`/projects/${p.id}`) })}
        />
      </div>
    </Require>
  );
}
