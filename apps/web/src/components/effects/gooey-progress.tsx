import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface GooeyStep {
  key: string;
  label: string;
  /** 0–1 completion of this step. */
  fraction: number;
}

interface GooeyProgressProps {
  steps: GooeyStep[];
  /** Overall percentage announced to assistive tech. */
  value: number;
  label: string;
  className?: string;
}

/**
 * Liquid progress track: completed step dots melt into the fill through an SVG
 * "goo" filter, and a droplet pulses at the leading edge. The fill ends exactly
 * at the current step, interpolated by that step's own completion.
 */
export function GooeyProgress({ steps, value, label, className }: GooeyProgressProps) {
  const filterId = `goo-${useId().replace(/:/g, '')}`;
  const gaps = Math.max(steps.length - 1, 1);
  const firstOpen = steps.findIndex((s) => s.fraction < 1);
  const reached =
    firstOpen === -1
      ? gaps
      : Math.max(0, firstOpen - 1 + (firstOpen === 0 ? 0 : steps[firstOpen]!.fraction));
  const fillPct = firstOpen === -1 ? 100 : (reached / gaps) * 100;
  const pos = (i: number) => `${(i / gaps) * 100}%`;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn('relative h-6', className)}
    >
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* Track and upcoming dots */}
      <div
        className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20"
        aria-hidden
      />
      <div className="absolute inset-x-2 inset-y-0" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s.key}
            title={s.label}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30"
            style={{ left: pos(i) }}
          />
        ))}
      </div>

      {/* Liquid layer */}
      <div
        className="absolute inset-x-2 inset-y-0"
        style={{ filter: `url(#${filterId})` }}
        aria-hidden
      >
        <span
          className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-full bg-amber-300 transition-[width] duration-700"
          style={{ width: `${fillPct}%` }}
        />
        {steps.map((s, i) =>
          s.fraction >= 1 ? (
            <span
              key={s.key}
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300"
              style={{ left: pos(i) }}
            />
          ) : null,
        )}
        {firstOpen !== -1 && (
          <span
            className="fx-drop absolute top-1/2 size-4 rounded-full bg-amber-200"
            style={{ left: `${fillPct}%` }}
          />
        )}
      </div>
    </div>
  );
}
