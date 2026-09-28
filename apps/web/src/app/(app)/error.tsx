'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page crashed"
      description={`Something unexpected happened while rendering this page.${error.digest ? ` Ref: ${error.digest}` : ''}`}
      action={
        <Button variant="outline" onClick={reset}>
          <RotateCw /> Try again
        </Button>
      }
    />
  );
}
