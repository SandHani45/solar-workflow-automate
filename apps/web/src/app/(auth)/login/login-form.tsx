'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@solar/shared';
import { api, errorMessage, fetchSession, refreshSession } from '@/lib/api-client';
import type { Session } from '@/lib/types';
import { DemoAccounts } from '@/components/auth/demo-accounts';
import { useAuthRedirect } from '@/components/auth/use-auth-redirect';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const params = useSearchParams();
  const redirect = useAuthRedirect();
  const [showPassword, setShowPassword] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (body: LoginInput) => api.post<Session>('/auth/login', body),
    onSuccess: redirect,
    meta: { skipErrorToast: true },
  });

  // The access cookie may have expired while the refresh cookie (scoped to /api/v1/auth) is still
  // valid: try a silent refresh before asking for credentials.
  const reauth = params.has('reauth');
  useEffect(() => {
    if (reauth) return;
    let cancelled = false;
    void (async () => {
      if (!(await refreshSession())) return;
      const session = await fetchSession().catch(() => null);
      if (session && !cancelled) redirect(session);
    })();
    return () => {
      cancelled = true;
    };
  }, [reauth, redirect]);

  const pickDemo = (email: string, password: string) => {
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', password, { shouldValidate: true });
    login.reset();
    submitRef.current?.focus();
  };

  const { errors } = form.formState;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your SolarFlow workspace.</p>
      </div>

      <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-4" noValidate>
        {login.error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {errorMessage(login.error)}
          </div>
        )}
        <FormField label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<Mail />}
            placeholder="you@company.in"
            {...form.register('email')}
          />
        </FormField>
        <div className="relative">
          <Link
            href="/forgot-password"
            className="absolute right-0 top-0 text-xs font-medium text-primary hover:underline dark:text-blue-400"
          >
            Forgot password?
          </Link>
          <FormField label="Password" error={errors.password}>
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              leading={<Lock />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="rounded p-1 hover:text-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              }
              {...form.register('password')}
            />
          </FormField>
        </div>
        <Button
          ref={submitRef}
          type="submit"
          className="w-full"
          size="lg"
          loading={login.isPending}
        >
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to SolarFlow?{' '}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline dark:text-blue-400"
        >
          Create your organisation
        </Link>
      </p>

      <DemoAccounts onPick={pickDemo} />
    </div>
  );
}
