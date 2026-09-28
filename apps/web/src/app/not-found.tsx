import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-amber-600">
        <Compass className="size-7" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-600">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">This page is off the grid</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      </div>
      <div className="flex gap-2">
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      </div>
    </main>
  );
}
