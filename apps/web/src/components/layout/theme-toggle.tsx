'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={label}>
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </Tooltip>
  );
}
