import { humanize } from '@solar/shared';
import type { Project } from '@/lib/types';
import { formatAddress, formatDate, formatINR } from '@/lib/utils';
import { roleName } from '@/lib/roles';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children ?? '—'}</dd>
    </div>
  );
}

/** Customer, survey, subsidy/loan and net-metering snapshots filled in by stage automations. */
export function OverviewTab({ project }: { project: Project }) {
  const s = project.survey;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Customer" />
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label="Name">{project.customer.name}</Row>
            <Row label="Phone">
              <a href={`tel:${project.customer.phone}`} className="text-primary dark:text-blue-400">
                {project.customer.phone}
              </a>
            </Row>
            <Row label="Email">{project.customer.email || '—'}</Row>
            <Row label="Address">{formatAddress(project.customer.address) || '—'}</Row>
            <Row label="Consumer no.">{project.customer.consumerNumber || '—'}</Row>
            <Row label="Type">
              {humanize(project.customerType)} · {humanize(project.connectionType)}
            </Row>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Team" />
        <CardContent>
          <dl className="divide-y divide-border">
            {(['sales', 'manager', 'engineer', 'operations'] as const).map((r) => (
              <Row key={r} label={roleName(r)}>
                {project.team?.[r]?.name ?? <span className="font-normal text-muted-foreground">Not assigned</span>}
              </Row>
            ))}
            <Row label="Installation date">{formatDate(project.installationDate)}</Row>
            <Row label="Created">{formatDate(project.createdAt)}</Row>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Subsidy & loan" description="PM Surya Ghar and bank finance" />
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label="Subsidy status">
              <StatusBadge status={project.subsidy?.status ?? 'not_applied'} />
            </Row>
            <Row label="Application no.">{project.subsidy?.applicationNo || '—'}</Row>
            <Row label="Subsidy amount">{project.subsidy?.amount ? formatINR(project.subsidy.amount) : project.expectedSubsidy ? `${formatINR(project.expectedSubsidy)} (expected)` : '—'}</Row>
            <Row label="Loan">
              <StatusBadge status={project.loan?.status ?? 'not_required'} />
            </Row>
            {project.loan?.bank && (
              <Row label="Bank">
                {project.loan.bank} · {formatINR(project.loan.amount)}
              </Row>
            )}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Net-metering" description="DISCOM application to meter fixing" />
        <CardContent>
          <dl className="divide-y divide-border">
            <Row label="Status">
              <StatusBadge status={project.netMetering?.status ?? 'not_started'} />
            </Row>
            <Row label="Application no.">{project.netMetering?.applicationNo || '—'}</Row>
            <Row label="Inspection">{formatDate(project.netMetering?.inspectionDate)}</Row>
            <Row label="Meter number">{project.netMetering?.meterNumber || '—'}</Row>
          </dl>
        </CardContent>
      </Card>
      {s && (
        <Card className="lg:col-span-2">
          <CardHeader title="Site survey" />
          <CardContent>
            <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              <Row label="Survey date">{formatDate(s.surveyDate)}</Row>
              <Row label="Roof">{s.roofType ? humanize(s.roofType) : '—'}</Row>
              <Row label="Floors">{s.floors ?? '—'}</Row>
              <Row label="Shadow-free area">{s.shadowFreeAreaSqft ? `${s.shadowFreeAreaSqft} sq.ft` : '—'}</Row>
              <Row label="Sanctioned load">{s.sanctionedLoadKw ? `${s.sanctionedLoadKw} kW` : '—'}</Row>
            </dl>
            {s.notes && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line">{s.notes}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
