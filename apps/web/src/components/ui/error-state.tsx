'use client';

import { AlertTriangle, Lock, PowerOff, RotateCw, SearchX } from 'lucide-react';
import { ApiError, errorMessage } from '@/lib/api-client';
import { Button } from './button';
import { EmptyState } from './empty-state';

/** Friendly rendering of a failed query, with specific copy for 403/404/feature-disabled. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  if (error instanceof ApiError) {
    if (error.code === 'FEATURE_DISABLED') {
      return <EmptyState className={className} icon={PowerOff} title="Feature not enabled" description="This module is turned off for your organisation or role. Ask an admin to enable it in Settings → Features." />;
    }
    if (error.status === 403) {
      return <EmptyState className={className} icon={Lock} title="You don't have access" description={error.message || 'Your role does not include permission for this page.'} />;
    }
    if (error.status === 404) {
      return <EmptyState className={className} icon={SearchX} title="Not found" description="It may have been deleted, or the link is wrong." />;
    }
  }
  return (
    <EmptyState
      className={className}
      icon={AlertTriangle}
      title="Couldn't load this"
      description={errorMessage(error)}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        )
      }
    />
  );
}
