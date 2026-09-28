'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { forgotPasswordSchema } from '@solar/shared';
import type { z } from 'zod';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const form = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const send = useMutation({ mutationFn: (v: Values) => api.post('/auth/forgot-password', v) });

  if (send.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">If an account exists for {form.getValues('email')}, we&apos;ve sent a link to reset the password. It expires in 1 hour.</p>
        <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-blue-400">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-4" noValidate>
        <FormField label="Email" error={form.formState.errors.email}>
          <Input type="email" autoComplete="email" leading={<Mail />} {...form.register('email')} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={send.isPending}>
          Send reset link
        </Button>
      </form>
      <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
