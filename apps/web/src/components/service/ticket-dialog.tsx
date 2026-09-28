'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { humanize, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_SLA_HOURS, ticketSchema } from '@solar/shared';
import type { z } from 'zod';
import { useCreateTicket } from '@/hooks/api/use-service';
import { ProjectPicker } from '@/components/projects/project-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type In = z.input<typeof ticketSchema>;
type Out = z.output<typeof ticketSchema>;

export function TicketDialog({ open, onOpenChange, projectId, customerMode }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string; customerMode?: boolean }) {
  const create = useCreateTicket();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { projectId: projectId ?? '', subject: '', description: '', category: 'low_generation', priority: 'medium' },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    create.mutate(v, {
      onSuccess: () => {
        form.reset();
        onOpenChange(false);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={customerMode ? 'Report an issue' : 'New service ticket'}
      description={customerMode ? 'Our service team will get back to you within the response time shown.' : undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {customerMode ? 'Submit' : 'Create ticket'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!projectId && (
          <FormField label="Project" error={errors.projectId} required className="sm:col-span-2" htmlFor="tk-project">
            <Controller control={form.control} name="projectId" render={({ field }) => <ProjectPicker id="tk-project" value={field.value} onChange={(p) => field.onChange(p.id)} />} />
          </FormField>
        )}
        <FormField label="Subject" error={errors.subject} required className="sm:col-span-2">
          <Input placeholder="e.g. Inverter showing grid fault" {...form.register('subject')} />
        </FormField>
        <FormField label="Category" error={errors.category}>
          <Select options={TICKET_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} {...form.register('category')} />
        </FormField>
        <FormField label="Priority" error={errors.priority}>
          <Select options={TICKET_PRIORITIES.map((p) => ({ value: p, label: `${humanize(p)} · ${TICKET_SLA_HOURS[p]}h` }))} {...form.register('priority')} />
        </FormField>
        <FormField label="Description" error={errors.description} required className="sm:col-span-2">
          <Textarea rows={4} placeholder="What happened, since when, any error code on the inverter…" {...form.register('description')} />
        </FormField>
      </form>
    </Dialog>
  );
}
