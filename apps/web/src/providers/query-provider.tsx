'use client';

import { MutationCache, QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/lib/api-client';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError | Error;
    mutationMeta: {
      /** Toast shown on success. */
      successMessage?: string;
      /** Query keys invalidated after success. */
      invalidates?: QueryKey[];
      /** The caller renders the error itself (e.g. STAGE_RULE reasons). */
      skipErrorToast?: boolean;
    };
  }
}

function makeClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
    mutationCache: new MutationCache({
      onSuccess: async (_data, _vars, _ctx, mutation) => {
        const meta = mutation.meta;
        if (meta?.successMessage) toast.success(meta.successMessage);
        if (meta?.invalidates) await Promise.all(meta.invalidates.map((queryKey) => client.invalidateQueries({ queryKey })));
      },
      onError: (err, _vars, _ctx, mutation) => {
        if (mutation.meta?.skipErrorToast) return;
        toast.error(errorMessage(err));
      },
    }),
  });
  return client;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
