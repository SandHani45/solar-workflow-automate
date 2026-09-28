import Link from 'next/link';
import { CalendarDays, Zap } from 'lucide-react';
import type { ProjectSummary } from '@/lib/types';
import { formatDate, formatINRCompact } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function ProjectBoardCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`} className="block rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tabular text-[11px] font-medium text-muted-foreground">{project.code}</p>
          <p className="truncate text-sm font-semibold">{project.customer.name}</p>
        </div>
        {project.status !== 'active' && <StatusBadge status={project.status} />}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Zap className="size-3 text-amber-500" aria-hidden />
          {project.systemSizeKw} kW
        </span>
        <span className="tabular">{formatINRCompact(project.contractValue)}</span>
        {project.installationDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" aria-hidden />
            {formatDate(project.installationDate, 'd MMM')}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={project.progress} className="h-1.5" label={`${project.code} progress`} />
        <span className="tabular w-8 text-right text-[11px] text-muted-foreground">{project.progress}%</span>
        {project.team?.engineer && <Avatar name={project.team.engineer.name} size="xs" />}
      </div>
    </Link>
  );
}
