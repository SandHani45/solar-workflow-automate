'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ButtonLink } from '@/components/ui/button';

const LINKS = [
  { href: '/#workflow', label: 'Workflow' },
  { href: '/#roles', label: 'Roles' },
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <ThemeToggle />
          <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" className="hidden sm:inline-flex">
            Start free trial
          </ButtonLink>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-border bg-background px-4 pt-2 pb-4 md:hidden">
          <nav aria-label="Mobile" className="grid">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ButtonLink href="/login" variant="outline">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register">Start free trial</ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
