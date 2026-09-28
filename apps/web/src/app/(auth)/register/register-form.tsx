'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, Lock, Mail, Phone, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { registerOrgSchema, type RegisterOrgInput } from '@solar/shared';
import { api, errorMessage } from '@/lib/api-client';
import type { Session } from '@/lib/types';
import { useAuthRedirect } from '@/components/auth/use-auth-redirect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export function RegisterForm() {
  const redirect = useAuthRedirect();
  const plan = useSearchParams().get('plan');
  const form = useForm<RegisterOrgInput>({ resolver: zodResolver(registerOrgSchema), defaultValues: { orgName: '', name: '', email: '', password: '' } });
  const register = useMutation({
    mutationFn: (body: RegisterOrgInput) => api.post<Session>('/auth/register', body),
    onSuccess: redirect,
    meta: { skipErrorToast: true },
  });
  const { errors } = form.formState;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create your organisation</h1>
          {plan && (
            <Badge tone="gold" className="capitalize">
              {plan}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Your workspace comes pre-loaded with the 7-phase solar workflow and default roles. 14-day free trial, no card needed.</p>
      </div>
      <form onSubmit={form.handleSubmit((v) => register.mutate(v))} className="space-y-4" noValidate>
        {register.error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {errorMessage(register.error)}
          </div>
        )}
        <FormField label="Company name" error={errors.orgName} required>
          <Input leading={<Building2 />} placeholder="Suryodaya Solar Pvt Ltd" autoComplete="organization" {...form.register('orgName')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Your name" error={errors.name} required>
            <Input leading={<User />} autoComplete="name" {...form.register('name')} />
          </FormField>
          <FormField label="Phone" error={errors.phone} hint="Optional">
            <Input leading={<Phone />} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" {...form.register('phone', { setValueAs: emptyToUndefined })} />
          </FormField>
        </div>
        <FormField label="Work email" error={errors.email} required>
          <Input leading={<Mail />} type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password} hint="At least 8 characters with a letter and a number" required>
          <Input leading={<Lock />} type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          Create workspace
        </Button>
        <p className="text-center text-xs text-muted-foreground">By continuing you agree to the Terms and Privacy Policy.</p>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline dark:text-blue-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
