'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Lock, MailWarning, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema } from '@solar/shared';
import { api, errorMessage } from '@/lib/api-client';
import type { InviteInfo, Session } from '@/lib/types';
import { useAuthRedirect } from '@/components/auth/use-auth-redirect';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({ name: z.string().trim().min(2, 'Enter your name'), password: passwordSchema });
type Values = z.infer<typeof schema>;

export function AcceptInviteForm({ token }: { token: string }) {
  const redirect = useAuthRedirect();
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => api.get<InviteInfo>(`/auth/invite/${token}`, undefined, { noRedirect: true }), retry: false });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', password: '' } });
  const accept = useMutation({
    mutationFn: (v: Values) => api.post<Session>('/auth/accept-invite', { token, ...v }),
    onSuccess: redirect,
    meta: { skipErrorToast: true },
  });

  if (invite.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (invite.isError) {
    return (
      <EmptyState
        icon={MailWarning}
        title="This invitation isn't valid"
        description="It may have expired or already been used. Ask your admin to send a new invite."
        action={<ButtonLink href="/login">Go to sign in</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-amber-600">You&apos;re invited</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Join {invite.data.orgName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          as <span className="font-medium text-foreground">{invite.data.roleName}</span> · {invite.data.email}
        </p>
      </div>
      <form onSubmit={form.handleSubmit((v) => accept.mutate(v))} className="space-y-4" noValidate>
        {accept.error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {errorMessage(accept.error)}
          </div>
        )}
        <FormField label="Your name" error={form.formState.errors.name}>
          <Input leading={<User />} autoComplete="name" {...form.register('name')} />
        </FormField>
        <FormField label="Create a password" error={form.formState.errors.password} hint="At least 8 characters with a letter and a number">
          <Input leading={<Lock />} type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={accept.isPending}>
          Accept & continue
        </Button>
      </form>
    </div>
  );
}
