'use client';

import { ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_ACCOUNTS: { email: string; role: string; password: string; lands: string }[] = [
  { email: 'owner@demo.solar', role: 'Owner / Partner', password: DEMO_PASSWORD, lands: 'Everything incl. partner split' },
  { email: 'admin@demo.solar', role: 'Admin', password: DEMO_PASSWORD, lands: 'Users, roles, workflow, settings' },
  { email: 'manager@demo.solar', role: 'Project Manager', password: DEMO_PASSWORD, lands: 'All projects, overrides' },
  { email: 'sales@demo.solar', role: 'Sales Executive', password: DEMO_PASSWORD, lands: 'Leads, survey, quotations' },
  { email: 'operations@demo.solar', role: 'Operations', password: DEMO_PASSWORD, lands: 'KYC, subsidy, net-metering' },
  { email: 'warehouse@demo.solar', role: 'Warehouse', password: DEMO_PASSWORD, lands: 'Stock & dispatch' },
  { email: 'engineer@demo.solar', role: 'Site Engineer', password: DEMO_PASSWORD, lands: 'Installation & photos' },
  { email: 'accounts@demo.solar', role: 'Accounts', password: DEMO_PASSWORD, lands: 'Payments, expenses, finance' },
  { email: 'service@demo.solar', role: 'Service Technician', password: DEMO_PASSWORD, lands: 'Tickets & AMC' },
  { email: 'customer@demo.solar', role: 'Customer', password: DEMO_PASSWORD, lands: 'Customer portal' },
  { email: 'superadmin@solarflow.app', role: 'Platform super admin', password: 'ChangeMe123!', lands: 'Tenants & feature catalogue' },
];

/** Click a seeded account to fill the login form — handy for demos and QA. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-dashed border-amber-300 bg-accent-soft/70 dark:border-amber-500/30" aria-labelledby="demo-accounts-title">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <Sparkles className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <span id="demo-accounts-title" className="flex-1 text-sm font-semibold">
          Demo accounts
        </span>
        <span className="text-xs text-muted-foreground">password {DEMO_PASSWORD}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul className="grid grid-cols-2 gap-1 px-2 pb-2">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => onPick(a.email, a.password)}
                className="w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-card focus-visible:bg-card"
                title={a.lands}
              >
                <span className="block text-xs font-medium">{a.role}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{a.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
