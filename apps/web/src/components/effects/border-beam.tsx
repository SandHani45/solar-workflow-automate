import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type BeamTone = 'solar' | 'blue' | 'danger' | 'success';

const TONES: Record<BeamTone, [string, string]> = {
  solar: ['#3b82f6', '#fbbf24'],
  blue: ['#60a5fa', '#1d4ed8'],
  danger: ['#fb7185', '#e11d48'],
  success: ['#34d399', '#059669'],
};

interface BorderBeamProps {
  tone?: BeamTone;
  /** Seconds per revolution. */
  duration?: number;
  /** Beam thickness in px. */
  width?: number;
  /** Adds a soft blurred halo under the beam. */
  glow?: boolean;
  className?: string;
}

/**
 * A light beam that travels around its parent's border. The parent needs
 * `position: relative` and a border radius; the beam inherits the radius.
 */
export function BorderBeam({
  tone = 'solar',
  duration = 6,
  width = 1.5,
  glow = true,
  className,
}: BorderBeamProps) {
  const [from, to] = TONES[tone];
  const style = {
    '--fx-beam-from': from,
    '--fx-beam-to': to,
    '--fx-beam-duration': `${duration}s`,
    '--fx-beam-width': `${width}px`,
  } as CSSProperties;
  return (
    <>
      {glow && <span aria-hidden className={cn('fx-beam fx-beam-glow', className)} style={style} />}
      <span aria-hidden className={cn('fx-beam', className)} style={style} />
    </>
  );
}
