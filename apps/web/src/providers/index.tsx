'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from './query-provider';
import { ThemeProvider, useTheme } from './theme-provider';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider delayDuration={250}>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
