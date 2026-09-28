'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema } from '@solar/shared';
import { useSession } from '@/hooks/use-session';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const session = useSession();
  const { user, role, org } = session;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const change = useMutation({
    mutationFn: (v: Values) => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => form.reset(),
    meta: { successMessage: 'Password changed' },
  });
  const { errors } = form.formState;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Profile" />
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.isSuperAdmin && <Badge tone="gold">Super admin</Badge>}
              {role && <Badge tone="blue">{role.name}</Badge>}
              {org && <Badge>{org.name}</Badge>}
            </div>
          </div>
        </CardContent>
        {user.lastLoginAt && <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">Last sign-in {formatDateTime(user.lastLoginAt)}</p>}
      </Card>
      <Card>
        <CardHeader title="Change password" description="You'll stay signed in on this device." />
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate>
          <CardContent className="grid gap-4">
            <FormField label="Current password" error={errors.currentPassword}>
              <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </FormField>
            <FormField label="New password" error={errors.newPassword} hint="At least 8 characters with a letter and a number">
              <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </FormField>
            <FormField label="Confirm new password" error={errors.confirm}>
              <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button type="submit" loading={change.isPending}>
              <KeyRound /> Update password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
