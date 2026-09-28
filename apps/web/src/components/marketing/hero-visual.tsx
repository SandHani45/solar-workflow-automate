import { AlertCircle, Check, IndianRupee, Zap } from 'lucide-react';
import { PHASES } from '@solar/shared';
import { cn } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';

/** Static product preview for the hero — built from real phase data, no screenshots to go stale. */
export function HeroVisual() {
  const doneThrough = 3; // phases 1-3 complete, 4 in progress
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-transparent to-amber-400/25 blur-2xl" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-blue-900/10 sm:p-5 sm:pb-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">SP-2026-0042 · Residential · On-grid</p>
            <p className="mt-0.5 font-semibold">Sharma Residence, Jaipur</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-600/15 ring-inset dark:bg-violet-500/15 dark:text-violet-300">
            <span className="size-1.5 rounded-full bg-violet-500" /> Installation
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['System', '5.4 kW'],
            ['Contract', '₹3,15,000'],
            ['Received', '₹2,20,500'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted/60 px-2 py-2">
              <p className="text-[10px] text-muted-foreground">{k}</p>
              <p className="tabular text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Workflow progress</span>
            <span className="tabular text-muted-foreground">61%</span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {PHASES.map((p) => (
              <div key={p.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full', TONE_STYLES[p.color].dot)} style={{ width: p.order <= doneThrough ? '100%' : p.order === doneThrough + 1 ? '45%' : '0%' }} />
              </div>
            ))}
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {[
            { name: 'Installation schedule date fix', state: 'done' },
            { name: 'Installation as per schedule', state: 'active' },
            { name: 'Site team uploads photos', state: 'locked' },
          ].map((s) => (
            <li key={s.name} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm">
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full',
                  s.state === 'done' && 'bg-emerald-500 text-white',
                  s.state === 'active' && 'border-2 border-blue-500',
                  s.state === 'locked' && 'border-2 border-dashed border-border',
                )}
              >
                {s.state === 'done' && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn('flex-1 truncate', s.state === 'locked' && 'text-muted-foreground')}>{s.name}</span>
              {s.state === 'active' && <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">4/6 checks</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute -bottom-6 -left-3 hidden w-56 rounded-xl border border-border bg-card p-3 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
            <IndianRupee className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold">Advance received</p>
            <p className="tabular text-[11px] text-muted-foreground">₹94,500 via PhonePe</p>
          </div>
        </div>
      </div>
      <div className="absolute -top-5 -right-3 hidden w-60 rounded-xl border border-border bg-card p-3 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15">
            <AlertCircle className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold">Can&apos;t close yet</p>
            <p className="text-[11px] text-muted-foreground">Upload inverter photo · 2 checks left</p>
          </div>
        </div>
      </div>
      <div className="absolute right-6 -bottom-8 hidden items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:flex dark:bg-blue-600">
        <Zap className="size-3.5 text-amber-300" aria-hidden /> Net meter installed · 2 projects
      </div>
    </div>
  );
}
