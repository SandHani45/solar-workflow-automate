'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { FEATURE_CATALOGUE } from '@solar/shared';
import { PLANS } from '@/lib/plans';
import { cn, formatINR } from '@/lib/utils';
import { BorderBeam } from '@/components/effects';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/tabs';

const FEATURE_NAME = new Map(FEATURE_CATALOGUE.map((f) => [f.key, f.name]));

export function PricingCards({ compact }: { compact?: boolean }) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <Segmented
          label="Billing period"
          value={billing}
          onChange={setBilling}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly · save 20%' },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const price = billing === 'yearly' ? plan.yearlyMonthly : plan.monthly;
          const inherited = i > 0 ? PLANS[i - 1] : undefined;
          const newFeatures = inherited ? plan.features.filter((f) => !inherited.features.includes(f)) : plan.features;
          return (
            <div
              key={plan.key}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm',
                plan.highlighted ? 'border-primary shadow-lg ring-1 ring-primary dark:border-blue-500 dark:ring-blue-500' : 'border-border',
              )}
            >
              {plan.highlighted && <BorderBeam tone="solar" duration={8} />}
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground shadow-sm">Most popular</span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                {price ? (
                  <>
                    <span className="tabular text-4xl font-semibold tracking-tight">{formatINR(price)}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </>
                ) : (
                  <span className="text-4xl font-semibold tracking-tight">Custom</span>
                )}
              </div>
              <p className="mt-1 h-4 text-xs text-muted-foreground">{price ? (billing === 'yearly' ? `Billed yearly · ${formatINR(price * 12)}/yr + GST` : 'Billed monthly + GST') : 'Volume & multi-branch pricing'}</p>
              <ButtonLink href={plan.key === 'enterprise' ? '/pricing#contact' : `/register?plan=${plan.key}`} variant={plan.highlighted ? 'metal' : 'outline'} className="mt-6 w-full">
                {plan.cta}
              </ButtonLink>
              <div className="mt-6 border-t border-border pt-5 text-sm">
                <p className="font-medium">
                  {plan.users} · {plan.projects}
                </p>
                <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{inherited ? `Everything in ${inherited.name}, plus` : 'Includes'}</p>
                <ul className="mt-2 space-y-2">
                  {(compact ? newFeatures.slice(0, 5) : newFeatures).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                      {FEATURE_NAME.get(f) ?? f}
                    </li>
                  ))}
                  {plan.extras.map((e) => (
                    <li key={e} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
