import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AcceptInviteForm } from './accept-invite-form';

export const metadata: Metadata = { title: 'Accept invitation' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense>
      <AcceptInviteForm token={token} />
    </Suspense>
  );
}
