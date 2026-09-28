'use client';

import { CheckCircle2, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_ROLES, DEFAULT_STAGES, PHASES } from '@solar/shared';
import { cn } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';

/** What each role actually does in SolarFlow, day to day. */
const ROLE_STORY: Record<string, { headline: string; screens: string[]; mobile?: boolean }> = {
  owner: { headline: 'See cash, profit and bottlenecks at a glance.', screens: ['Finance dashboard with profit by project', 'Partner profit split net of advances', 'Overdue stages across every site'] },
  manager: { headline: 'Keep every project moving and every crew busy.', screens: ['Phase board of all projects', 'Assign engineers and override blocked stages', 'Approve quotations and expenses'] },
  sales: { headline: 'Turn enquiries into signed orders faster.', screens: ['Lead pipeline with follow-up reminders', 'Quotation builder with GST and print view', 'Site survey form with roof photos'], mobile: true },
  operations: { headline: 'Never lose a KYC document or a DISCOM file again.', screens: ['Document checklist per stage', 'PM Surya Ghar subsidy & bank loan tracking', 'Net-metering application to meter fixing'] },
  warehouse: { headline: 'Know what is in stock, reserved and on the road.', screens: ['Stock in/out with weighted-average cost', 'Dispatch from BOQ with status tracking', 'Low-stock alerts'] },
  engineer: { headline: 'Finish the install checklist from the rooftop.', screens: ['Today’s tasks on the phone', 'Installation checklist with serial numbers', 'Upload module & inverter photos in place'], mobile: true },
  accounts: { headline: 'Collect every rupee and close every project clean.', screens: ['Record payments by PhonePe, UPI, bank, cash', 'Expense approval queue', 'Pending customers with one-tap call'] },
  service: { headline: 'Resolve complaints inside SLA and keep AMC revenue flowing.', screens: ['Tickets with SLA countdown', 'AMC visit checklists', 'Customer history in one place'], mobile: true },
  customer: { headline: 'Track the installation without calling the office.', screens: ['Live progress across 7 phases', 'Download invoice, warranty & certificates', 'Raise and follow service tickets'], mobile: true },
};

const ROLES = DEFAULT_ROLES.filter((r) => r.key !== 'admin');

export function RolesExplainer() {
  const [roleKey, setRoleKey] = useState('sales');
  const role = ROLES.find((r) => r.key === roleKey) ?? ROLES[0]!;
  const story = ROLE_STORY[role.key];
  const owned = DEFAULT_STAGES.filter((s) => s.ownerRoles.includes(role.key));

  return (
    <div>
      <div role="tablist" aria-label="Roles" className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {ROLES.map((r) => (
          <button
            key={r.key}
            role="tab"
            type="button"
            aria-selected={r.key === role.key}
            onClick={() => setRoleKey(r.key)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              r.key === role.key ? 'border-primary bg-primary text-primary-foreground dark:border-blue-500 dark:bg-blue-600' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {r.name.split(' / ')[0]}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6 grid gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{role.name}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">{story?.headline}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
          <ul className="mt-5 space-y-2.5">
            {story?.screens.map((s) => (
              <li key={s} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
          {story?.mobile && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Smartphone className="size-4" aria-hidden /> Designed to work one-handed on a phone.
            </p>
          )}
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {owned.length > 0 ? `Stages this role owns (${owned.length})` : 'Access'}
          </p>
          {owned.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {owned.map((s) => {
                const phase = PHASES.find((p) => p.key === s.phase);
                return (
                  <li key={s.key} className="flex items-center gap-2.5 rounded-lg bg-card px-3 py-2 text-sm shadow-xs">
                    <span className={cn('size-2 shrink-0 rounded-full', phase && TONE_STYLES[phase.color].dot)} aria-hidden />
                    <span className="tabular w-6 text-xs text-muted-foreground">#{s.step}</span>
                    <span className="flex-1 truncate">{s.name}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {role.key === 'customer'
                ? 'Customers get a read-only portal for their own project: progress, documents, payments and service tickets.'
                : 'Oversees every stage with full override rights, finance and profit-split access.'}
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{role.permissions.length} permissions by default · fully editable by your admin.</p>
        </div>
      </div>
    </div>
  );
}
