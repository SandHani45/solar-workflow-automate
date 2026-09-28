'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * A URL search-param backed state value (tabs, filters, open drawers) so views are linkable and
 * survive refresh. Setting `null`/'' removes the param.
 */
export function useQueryState(key: string, fallback = ''): [string, (v: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (v: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (v === null || v === '' || v === fallback) next.delete(key);
      else next.set(key, v);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname, key, fallback],
  );
  return [value, set];
}

/** Several params at once, e.g. list filters + page reset. */
export function useQueryParams(): [URLSearchParams, (patch: Record<string, string | null>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );
  return [params, set];
}
