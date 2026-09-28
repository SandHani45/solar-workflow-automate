'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema } from '@solar/shared';
import { api } from '@/lib/api-client';
import { ButtonLink, Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });
  const reset = useMutation({ mutationFn: (v: Values) => api.post('/auth/reset-password', { token, password: v.password }) });

  if (!token) {
    return <EmptyState title="Invalid reset link" description="This link is missing its token. Request a new one." action={<ButtonLink href="/forgot-password">Request new link</ButtonLink>} />;
  }
  if (reset.isSuccess) {
    return (
      <EmptyState icon={CheckCircle2} title="Password updated" description="You can now sign in with your new password." action={<ButtonLink href="/login">Sign in</ButtonLink>} />
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">At least 8 characters with a letter and a number.</p>
      </div>
      <form onSubmit={form.handleSubmit((v) => reset.mutate(v))} className="space-y-4" noValidate>
        <FormField label="New password" error={form.formState.errors.password}>
          <Input type="password" autoComplete="new-password" leading={<Lock />} {...form.register('password')} />
        </FormField>
        <FormField label="Confirm password" error={form.formState.errors.confirm}>
          <Input type="password" autoComplete="new-password" leading={<Lock />} {...form.register('confirm')} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
          Update password
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
