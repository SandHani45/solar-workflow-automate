import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { PHASES } from '@solar/shared';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { TONE_STYLES } from '@/lib/status';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1a45] via-[#1e3a8a] to-[#1d4ed8] p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.35),rgba(251,191,36,0)_65%)]" />
        <div aria-hidden className="absolute bottom-0 left-0 h-64 w-full bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.18),transparent_60%)]" />
        <Logo className="relative text-white [&_span_span]:text-amber-300" />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Every rooftop, every rupee — from lead to profit.</h2>
          <p className="mt-3 text-sm text-blue-100/85">
            One workflow for sales, documents, PM Surya Ghar subsidy, logistics, installation, DISCOM net-metering, service and finance.
          </p>
          <ol className="mt-8 space-y-2.5">
            {PHASES.map((p) => (
              <li key={p.key} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${TONE_STYLES[p.color].dot}`}>{p.order}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-blue-100/70">{p.description}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-center gap-2 text-xs text-blue-100/80">
            <CheckCircle2 className="size-4 text-amber-300" aria-hidden /> Role-based access · audit log · customer portal
          </p>
        </div>
      </aside>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
