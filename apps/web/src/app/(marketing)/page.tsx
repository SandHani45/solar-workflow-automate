import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BadgeCheck, CheckCircle2, GitBranch, History, Layers3, Lock, ShieldCheck, Timer, ToggleRight, Users } from 'lucide-react';
import { ALL_PERMISSIONS, DEFAULT_ROLES, DEFAULT_STAGES, FEATURE_CATALOGUE, PERMISSION_GROUPS, PHASES, type FeatureDefinition } from '@solar/shared';
import { cn } from '@/lib/utils';
import { TONE_STYLES } from '@/lib/status';
import { FEATURE_ICONS } from '@/components/marketing/feature-icons';
import { HeroVisual } from '@/components/marketing/hero-visual';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { RolesExplainer } from '@/components/marketing/roles-explainer';
import { FaqList, Section } from '@/components/marketing/section';
import { WorkflowExplorer } from '@/components/marketing/workflow-explorer';
import { BorderBeam } from '@/components/effects';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: { absolute: 'SolarFlow — Run your solar business from lead to profit' } };

const CATEGORY_LABELS: Record<FeatureDefinition['category'], string> = {
  sales: 'Sell',
  operations: 'Deliver',
  finance: 'Get paid',
  service: 'Delight',
  platform: 'Control',
};

const ENGINE_POINTS = [
  { icon: GitBranch, title: 'Parallel tracks', body: 'Once the advance lands, documentation, logistics and engineer allocation run side by side — a dependency graph, not a single line.' },
  { icon: ShieldCheck, title: 'Gates that stop mistakes', body: 'A stage can’t close until its documents, checklist, form fields and payment thresholds are met. No more “installed but no advance”.' },
  { icon: Timer, title: 'SLAs and a task inbox', body: 'Every stage gets a due date when it unlocks. Each role sees exactly what’s theirs, with overdue work flagged.' },
  { icon: History, title: 'Versioned & customisable', body: 'Rename, reorder or re-own stages for your company. Projects snapshot the version they started with.' },
];

const FAQS = [
  { q: 'Does SolarFlow handle PM Surya Ghar subsidy tracking?', a: 'Yes. The “Apply for Subsidy & Bank Loan” stage captures the national-portal application number and expected subsidy, and project financials treat subsidy credits correctly when checking full payment at closure.' },
  { q: 'Can we change the workflow to match our SOP?', a: 'Admins can rename stages, change owners, SLAs, required documents and checklists, disable optional stages and reorder them. Each project keeps the workflow version it was created with, so edits never break jobs in flight.' },
  { q: 'Will my site engineers be able to use it on their phones?', a: 'Absolutely. Stage completion, checklists and photo uploads are designed for a 375px screen and poor rooftop connectivity, with upload progress and instant checklist ticks.' },
  { q: 'How does access control work?', a: 'Roles are bundles of 42 fine-grained permissions. On top, every module is a feature flag: the platform sets the plan default, your admin can switch modules off or restrict them to certain roles.' },
  { q: 'Can customers see their project?', a: 'With the Customer Portal module, customers log in to see their progress across all seven phases, download documents, check payments and raise service tickets.' },
  { q: 'Is our data isolated from other companies?', a: 'Every record is scoped to your organisation on the server and the organisation is always taken from your session — never from the browser. Every change is written to an audit log.' },
];

export default function LandingPage() {
  const byCategory = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({ cat, label, items: FEATURE_CATALOGUE.filter((f) => f.category === cat) }));
  const stats = [
    { value: PHASES.length, label: 'phases from lead to closure' },
    { value: DEFAULT_STAGES.length, label: 'gated workflow stages' },
    { value: DEFAULT_ROLES.length, label: 'ready-made roles' },
    { value: ALL_PERMISSIONS.length, label: 'fine-grained permissions' },
  ];

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_70%_-10%,rgba(251,191,36,0.16),transparent),radial-gradient(50rem_30rem_at_10%_0%,rgba(37,99,235,0.14),transparent)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:48px_48px] opacity-40" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-accent-soft px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:text-amber-300">
              <BadgeCheck className="size-3.5" aria-hidden /> Built for Indian rooftop EPCs · PM Surya Ghar ready
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Run your solar business from <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">lead to profit</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
              SolarFlow turns your SOP into a live workflow: quotations, KYC, subsidy and loans, stock and dispatch, installation, DISCOM net-metering, service and a real profit sheet — with every team seeing exactly what’s theirs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg" variant="metal">
                Start free trial <ArrowRight />
              </ButtonLink>
              <ButtonLink href="/#workflow" size="lg" variant="outline">
                See how the workflow works
              </ButtonLink>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {['GST quotations & A4 printouts', 'Payments by PhonePe, UPI, bank, cash', 'Photo uploads from the rooftop', 'Customer portal & service SLAs'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ── Stats ── */}
      <section aria-label="SolarFlow in numbers" className="border-y border-border bg-card px-4 sm:px-6">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-border py-8 sm:py-10 lg:grid-cols-4 lg:divide-x">
          {stats.map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="tabular block text-3xl font-semibold tracking-tight text-primary sm:text-4xl dark:text-blue-400">{s.value}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Workflow ── */}
      <Section
        id="workflow"
        eyebrow="How the workflow works"
        title="Your SOP, running as a workflow engine"
        description="Seven phases, each with stages that have owners, SLAs, checklists, required documents and payment gates. Pick a phase to see exactly what happens and who does it."
      >
        <ol aria-label="Phases" className="mb-10 hidden items-center justify-between gap-2 md:flex">
          {PHASES.map((p, i) => (
            <li key={p.key} className="flex flex-1 items-center gap-2">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm', TONE_STYLES[p.color].dot)}>{p.order}</span>
              <span className="text-xs leading-tight font-medium">{p.name}</span>
              {i < PHASES.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>
        <WorkflowExplorer />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ENGINE_POINTS.map((p) => (
            <div key={p.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4 sm:block sm:p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary dark:text-blue-400">
                <p.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold sm:mt-4">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Roles ── */}
      <Section id="roles" eyebrow="Built for every desk" title="How it works for each role" description="Everyone gets a focused workspace: their tasks, their stages, their numbers — and nothing they shouldn’t see." className="bg-muted/40">
        <RolesExplainer />
      </Section>

      {/* ── Features ── */}
      <Section id="features" eyebrow="Modules" title="Everything a solar installer needs, in one place" description={`${FEATURE_CATALOGUE.length} modules you can switch on per organisation and per role.`}>
        <div className="space-y-10">
          {byCategory.map(({ cat, label, items }) => (
            <div key={cat}>
              <h3 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{label}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((f) => {
                  const Icon = FEATURE_ICONS[f.key];
                  return (
                    <div key={f.key} className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:block sm:p-5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-amber-600 dark:text-amber-400">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-semibold sm:mt-4">{f.name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Access control ── */}
      <Section
        id="access"
        eyebrow="Role-based access"
        title="The right access for every person"
        description="Three layers work together, so a site engineer never sees the profit split and an accountant never completes an installation by mistake."
        className="bg-muted/40"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <AccessCard icon={Lock} step="1" title="Permissions" body={`${ALL_PERMISSIONS.length} permissions in ${Object.keys(PERMISSION_GROUPS).length} groups — from “View leads” to “Override stage rules”.`}>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PERMISSION_GROUPS)
                .slice(0, 10)
                .map((g) => (
                  <span key={g} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs capitalize">
                    {g}
                  </span>
                ))}
              <span className="rounded-md px-2 py-0.5 text-xs text-muted-foreground">+{Object.keys(PERMISSION_GROUPS).length - 10} more</span>
            </div>
          </AccessCard>
          <AccessCard icon={Users} step="2" title="Roles" body="Ten roles out of the box — edit them or build your own with a permission matrix. Owners always keep full access.">
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ROLES.map((r) => (
                <span key={r.key} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary dark:text-blue-300">
                  {r.name.split(' / ')[0]}
                </span>
              ))}
            </div>
          </AccessCard>
          <AccessCard icon={ToggleRight} step="3" title="Feature flags" body="Each module resolves in three levels, so plans, company policy and team roles all apply.">
            <ol className="space-y-1.5 text-xs">
              {['Platform default by plan', 'Organisation on/off (can be locked by platform)', 'Restricted to specific roles'].map((l, i) => (
                <li key={l} className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5">
                  <span className="tabular flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{i + 1}</span>
                  {l}
                </li>
              ))}
            </ol>
          </AccessCard>
        </div>
      </Section>

      {/* ── Pricing teaser ── */}
      <Section id="pricing" eyebrow="Pricing" title="Simple plans that grow with your installs" description="Every plan includes the full 7-phase workflow and unlimited customers. 14-day free trial.">
        <PricingCards compact />
        <p className="mt-8 text-center text-sm">
          <Link href="/pricing" className="inline-flex items-center gap-1 font-medium text-primary hover:underline dark:text-blue-400">
            Compare all plan features <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" eyebrow="FAQ" title="Questions installers ask us" className="bg-muted/40">
        <FaqList items={FAQS} />
      </Section>

      {/* ── CTA ── */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1a45] via-[#1e3a8a] to-[#1d4ed8] px-6 py-12 text-center text-white shadow-xl sm:px-12 sm:py-16">
          <BorderBeam tone="solar" duration={10} width={2} />
          <div aria-hidden className="absolute -top-20 -right-20 size-72 rounded-full bg-amber-400/30 blur-3xl" />
          <Layers3 className="mx-auto size-10 text-amber-300" aria-hidden />
          <h2 className="relative mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Put every project on one workflow this week</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-blue-100/90">Set up your organisation in two minutes. Import your team, keep your SOP, and see your first profit sheet at project closure.</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg" variant="metal">
              Start free trial <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              Explore the demo
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function AccessCard({ icon: Icon, step, title, body, children }: { icon: typeof Lock; step: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary dark:text-blue-400">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="text-xs font-semibold text-muted-foreground">Layer {step}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
