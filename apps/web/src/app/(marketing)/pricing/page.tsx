import type { Metadata } from 'next';
import { Check, Mail, Minus, Phone } from 'lucide-react';
import { FEATURE_CATALOGUE } from '@solar/shared';
import { PLANS } from '@/lib/plans';
import { cn } from '@/lib/utils';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { FaqList, Section } from '@/components/marketing/section';

export const metadata: Metadata = { title: 'Pricing', description: 'SolarFlow plans for rooftop solar installers: Starter, Growth and Enterprise.' };

const FAQS = [
  { q: 'Is there a free trial?', a: 'Every plan starts with a 14-day free trial with all Growth features. No card required.' },
  { q: 'Do prices include GST?', a: 'Prices are shown excluding 18% GST. You get a GST invoice with your GSTIN for input credit.' },
  { q: 'Can I switch plans later?', a: 'Yes, upgrade or downgrade at any time. Features switch on immediately; your data is never deleted.' },
  { q: 'Do customers count as users?', a: 'No. Customer portal logins are free and unlimited on every plan.' },
];

export default function PricingPage() {
  return (
    <>
      <section className="px-4 pt-14 pb-6 text-center sm:px-6 sm:pt-20">
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Pricing</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Plans for installers of every size</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">Start with the workflow, add warehouse, finance and service as you grow. Unlimited customers on every plan.</p>
      </section>

      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <PricingCards />
        </div>
      </section>

      <Section title="Compare plans" description="Every module, side by side." className="bg-muted/40">
        <div className="scrollbar-thin mx-auto max-w-5xl overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Feature comparison across plans</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Module
                </th>
                {PLANS.map((p) => (
                  <th key={p.key} scope="col" className={cn('px-4 py-3 text-center font-semibold', p.highlighted && 'text-primary dark:text-blue-400')}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  Users
                </th>
                {PLANS.map((p) => (
                  <td key={p.key} className="px-4 py-3 text-center text-muted-foreground">
                    {p.users.replace('Up to ', '')}
                  </td>
                ))}
              </tr>
              {FEATURE_CATALOGUE.map((f) => (
                <tr key={f.key} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <span className="font-medium">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{f.description}</span>
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-3 text-center">
                      {p.features.includes(f.key) ? (
                        <Check className="mx-auto size-4 text-emerald-500" aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="contact" title="Talk to us about Enterprise" description="Multi-branch rollouts, data migration from spreadsheets and custom workflows.">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <a href="mailto:sales@solarflow.app" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 hover:shadow-md">
            <Mail className="size-5 text-primary dark:text-blue-400" aria-hidden />
            <span>
              <span className="block font-medium">sales@solarflow.app</span>
              <span className="text-sm text-muted-foreground">Reply within one business day</span>
            </span>
          </a>
          <a href="tel:+918000000000" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 hover:shadow-md">
            <Phone className="size-5 text-primary dark:text-blue-400" aria-hidden />
            <span>
              <span className="block font-medium">+91 80000 00000</span>
              <span className="text-sm text-muted-foreground">Mon–Sat, 10am–7pm IST</span>
            </span>
          </a>
        </div>
        <div className="mt-14">
          <FaqList items={FAQS} />
        </div>
      </Section>
    </>
  );
}
