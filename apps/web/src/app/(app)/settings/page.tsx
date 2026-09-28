'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { orgSettingsSchema } from '@solar/shared';
import type { z } from 'zod';
import { useOrg, useUpdateOrg } from '@/hooks/api/use-org';
import { useCan, useSession } from '@/hooks/use-session';
import type { Org } from '@/lib/types';
import { compact } from '@/lib/utils';
import { resolveNav } from '@/components/layout/nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

type In = z.input<typeof orgSettingsSchema>;
type Out = z.output<typeof orgSettingsSchema>;

export default function OrgSettingsPage() {
  const session = useSession();
  const router = useRouter();
  const allowed = useCan({ permission: 'settings:manage' });
  const first = resolveNav(session).find((i) => i.basePath === '/settings')?.href;
  useEffect(() => {
    if (!allowed && first && first !== '/settings') router.replace(first);
  }, [allowed, first, router]);
  const { data, isLoading, error } = useOrg();
  if (!allowed || isLoading) return <PageSkeleton cards={0} />;
  if (error || !data) return <ErrorState error={error} />;
  return <OrgForm org={data} />;
}

function OrgForm({ org }: { org: Org }) {
  const update = useUpdateOrg();
  const s = org.settings ?? {};
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(orgSettingsSchema),
    defaultValues: { name: org.name, phone: s.phone, email: s.email ?? '', address: s.address ?? '', gstin: s.gstin ?? '', logoUrl: s.logoUrl ?? '', googleReviewUrl: s.googleReviewUrl ?? '', advancePercent: s.advancePercent ?? 30, defaultGstPercent: s.defaultGstPercent ?? 12 },
  });
  const { errors, isDirty } = form.formState;
  const empty = (v: unknown) => (v === '' ? undefined : v);

  return (
    <form onSubmit={form.handleSubmit((v) => update.mutate(compact(v) as Out, { onSuccess: () => form.reset(form.getValues()) }))} className="max-w-3xl space-y-5" noValidate>
      <Card>
        <CardHeader title="Company profile" description="Shown on quotations and receipts." />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company name" error={errors.name} className="sm:col-span-2">
            <Input {...form.register('name')} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <Input type="tel" {...form.register('phone', { setValueAs: empty })} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <Input type="email" {...form.register('email', { setValueAs: empty })} />
          </FormField>
          <FormField label="Address" error={errors.address} className="sm:col-span-2">
            <Textarea rows={2} {...form.register('address')} />
          </FormField>
          <FormField label="GSTIN" error={errors.gstin} hint="15-character GST number">
            <Input className="uppercase" maxLength={15} {...form.register('gstin')} />
          </FormField>
          <FormField label="Logo URL" error={errors.logoUrl}>
            <Input type="url" placeholder="https://…" {...form.register('logoUrl')} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Business rules" description="Used by workflow gates and quotations." />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Advance required (%)" error={errors.advancePercent} hint="“Advance Payment Collection” can't complete below this share of the contract value.">
            <Input type="number" min={0} max={100} {...form.register('advancePercent')} />
          </FormField>
          <FormField label="Default GST (%)" error={errors.defaultGstPercent} hint="Pre-filled on new quotation lines.">
            <Input type="number" min={0} max={28} {...form.register('defaultGstPercent')} />
          </FormField>
          <FormField label="Google review link" error={errors.googleReviewUrl} className="sm:col-span-2" hint="Shared with customers at the “Google Review & Rating” stage.">
            <Input type="url" placeholder="https://g.page/r/…" {...form.register('googleReviewUrl')} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty} loading={update.isPending}>
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
