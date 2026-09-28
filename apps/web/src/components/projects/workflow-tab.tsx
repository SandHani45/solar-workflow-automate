'use client';

import { ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PhaseKey } from '@solar/shared';
import { useSession } from '@/hooks/use-session';
import type { Project, ProjectDocument } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';
import { canActOnStage, projectPhases } from '@/lib/workflow';
import { Segmented } from '@/components/ui/tabs';
import { PhaseTimeline } from '@/components/workflow/phase-timeline';
import { StageCard } from '@/components/workflow/stage-card';

type Filter = 'all' | 'open' | 'mine';

/** Phases as sections, stages as cards. Clicking a card opens the StageDrawer (owned by the page). */
export function WorkflowTab({ project, documents, onOpenStage }: { project: Project; documents: ProjectDocument[]; onOpenStage: (key: string) => void }) {
  const session = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const phases = useMemo(() => projectPhases(project), [project]);
  const present = useMemo(() => new Set(documents.map((d) => d.type)), [documents]);

  const scrollTo = (key: PhaseKey) => document.getElementById(`phase-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <PhaseTimeline phases={phases} current={project.currentPhase} onSelect={scrollTo} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden /> Show
        </p>
        <Segmented
          label="Stage filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All stages' },
            { value: 'open', label: 'Open' },
            { value: 'mine', label: 'Mine' },
          ]}
        />
      </div>

      {phases.map(({ phase, stages, done }) => {
        const visible = stages.filter((v) => {
          if (filter === 'open') return v.state.status !== 'completed' && v.state.status !== 'skipped';
          if (filter === 'mine') return canActOnStage(session, v) && v.state.status !== 'completed' && v.state.status !== 'skipped' && (v.def.ownerRoles.includes(session.user.roleKey) || v.state.assignee?.id === session.user.id);
          return true;
        });
        if (visible.length === 0 && filter !== 'all') return null;
        const t = TONE_STYLES[phase.color];
        return (
          <section key={phase.key} id={`phase-${phase.key}`} aria-labelledby={`phase-h-${phase.key}`} className="scroll-mt-20">
            <header className="mb-3 flex items-center gap-2.5">
              <span className={cn('flex size-6 items-center justify-center rounded-md text-xs font-bold text-white', t.dot)}>{phase.order}</span>
              <h2 id={`phase-h-${phase.key}`} className="text-sm font-semibold">
                {phase.name}
              </h2>
              <span className="tabular text-xs text-muted-foreground">
                {done}/{stages.length}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {phase.description}</span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((v) => (
                <StageCard
                  key={v.def.key}
                  view={v}
                  tone={phase.color}
                  presentDocTypes={present}
                  mine={v.def.ownerRoles.includes(session.user.roleKey) || v.state.assignee?.id === session.user.id}
                  onOpen={() => onOpenStage(v.def.key)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
