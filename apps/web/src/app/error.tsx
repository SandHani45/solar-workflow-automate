'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">An unexpected error occurred. Try again, and if it keeps happening contact support{error.digest ? ` (ref ${error.digest})` : ''}.</p>
      </div>
      <div className="flex gap-2">
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
        <Button onClick={reset}>
          <RotateCw /> Try again
        </Button>
      </div>
    </main>
  );
}
