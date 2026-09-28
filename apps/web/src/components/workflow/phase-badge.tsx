import type { PhaseKey } from '@solar/shared';
import { Badge } from '@/components/ui/badge';
import { PHASE_BY_KEY, phaseTone } from '@/lib/status';

export function PhaseBadge({ phase, size }: { phase: PhaseKey; size?: 'sm' | 'md' }) {
  const def = PHASE_BY_KEY[phase];
  return (
    <Badge tone={phaseTone(phase)} dot size={size}>
      {def ? `${def.order}. ${def.name}` : phase}
    </Badge>
  );
}
