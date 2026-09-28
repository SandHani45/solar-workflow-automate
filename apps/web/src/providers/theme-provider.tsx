'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'sf-theme';

/**
 * Runs before hydration (inlined in <head>) so the correct theme class is applied on first paint.
 * Kept as a string because it must not depend on the React bundle.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (t: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  // OS theme changed or another tab changed the preference: re-apply the class, then re-render.
  const onExternalChange = () => {
    document.documentElement.classList.toggle('dark', resolve(readPreference()) === 'dark');
    cb();
  };
  mq.addEventListener('change', onExternalChange);
  window.addEventListener('storage', onExternalChange);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', onExternalChange);
    window.removeEventListener('storage', onExternalChange);
  };
}

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as const);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(readPreference()),
    () => 'light' as const,
  );

  const setPreference = useCallback((t: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // storage unavailable (private mode) — theme still applies for this page view
    }
    document.documentElement.classList.toggle('dark', resolve(t) === 'dark');
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark') }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
