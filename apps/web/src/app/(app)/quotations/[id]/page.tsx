'use client';

import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Pencil, Printer, Send, X } from 'lucide-react';
import { humanize } from '@solar/shared';
import { useQuotation, useQuotationStatus } from '@/hooks/api/use-quotations';
import { useCan, useSession } from '@/hooks/use-session';
import { formatAddress, formatDate, formatINR, formatKw, formatNumber } from '@/lib/utils';
import { Require } from '@/components/auth/require';
import { LogoMark } from '@/components/brand/logo';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function QuotationPage() {
  return (
    <Require permission="quotations:read" feature="quotations">
      <QuotationView />
    </Require>
  );
}

/** A4 printable quotation. The action bar is hidden in print (`.no-print`). */
function QuotationView() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const { data: q, isLoading, error, refetch } = useQuotation(id);
  const setStatus = useQuotationStatus(id);
  const canWrite = useCan({ permission: 'quotations:write' });
  const canApprove = useCan({ permission: 'quotations:approve' });

  if (isLoading) return <PageSkeleton cards={0} />;
  if (error || !q) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const org = q.org ?? { name: session.org?.name ?? '', address: session.org?.settings.address, phone: session.org?.settings.phone, email: session.org?.settings.email, gstin: session.org?.settings.gstin, logoUrl: session.org?.logoUrl };
  const customerAddress = typeof q.customer?.address === 'string' ? q.customer.address : formatAddress(q.customer?.address);
  const backHref = q.projectId ? `/projects/${q.projectId}?tab=quotations` : q.leadId ? `/leads/${q.leadId}` : '/quotations';

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <ButtonLink href={backHref} variant="ghost" size="sm">
          <ArrowLeft /> Back
        </ButtonLink>
        <StatusBadge status={q.status} size="md" />
        <div className="flex-1" />
        {canWrite && q.status === 'draft' && (
          <>
            <ButtonLink href={`/quotations/${q.id}/edit`} variant="outline" size="sm">
              <Pencil /> Edit
            </ButtonLink>
            <Button size="sm" variant="outline" loading={setStatus.isPending} onClick={() => setStatus.mutate('sent')}>
              <Send /> Mark as sent
            </Button>
          </>
        )}
        {canApprove && q.status === 'sent' && (
          <>
            <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setStatus.mutate('rejected')} disabled={setStatus.isPending}>
              <X /> Rejected
            </Button>
            <Button size="sm" onClick={() => setStatus.mutate('accepted')} loading={setStatus.isPending}>
              <Check /> Accepted
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer /> Print / PDF
        </Button>
      </div>

      <article className="print-area mx-auto max-w-[210mm] rounded-xl border border-border bg-white p-6 text-slate-900 shadow-sm sm:p-10 dark:bg-white">
        <header className="flex flex-col justify-between gap-6 border-b-2 border-[#1e3a8a] pb-6 sm:flex-row">
          <div className="flex items-start gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- org logo from any host
              <img src={org.logoUrl} alt="" className="size-12 object-contain" />
            ) : (
              <LogoMark className="size-12" />
            )}
            <div>
              <p className="text-lg font-bold">{org.name}</p>
              {org.address && <p className="max-w-xs text-xs whitespace-pre-line text-slate-600">{org.address}</p>}
              <p className="text-xs text-slate-600">{[org.phone, org.email].filter(Boolean).join(' · ')}</p>
              {org.gstin && <p className="text-xs font-medium text-slate-700">GSTIN: {org.gstin}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold tracking-tight text-[#1e3a8a]">QUOTATION</p>
            <p className="text-sm font-semibold">
              {q.number} <span className="font-normal text-slate-500">v{q.version}</span>
            </p>
            <p className="text-xs text-slate-600">Date: {formatDate(q.createdAt)}</p>
            {q.validUntil && <p className="text-xs text-slate-600">Valid until: {formatDate(q.validUntil)}</p>}
            <p className="text-xs text-slate-600">{humanize(q.kind)} quotation</p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Quotation for</p>
            <p className="mt-1 font-semibold">{q.customer?.name ?? q.project?.customerName ?? q.lead?.name ?? '—'}</p>
            {customerAddress && <p className="text-sm text-slate-600">{customerAddress}</p>}
            <p className="text-sm text-slate-600">{[q.customer?.phone, q.customer?.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">System</p>
            <p className="mt-1 font-semibold">{formatKw(q.systemSizeKw)} rooftop solar PV</p>
            {(q.project?.code || q.lead?.code) && <p className="text-sm text-slate-600">Ref: {q.project?.code ?? q.lead?.code}</p>}
          </div>
        </section>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-[#1e3a8a] text-left text-xs text-white">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">GST</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.lines.map((l, i) => {
                const base = l.quantity * l.unitPrice;
                return (
                  <tr key={`${l.description}-${i}`} className="border-b border-slate-200">
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="tabular px-3 py-2 text-right">{formatNumber(l.quantity, 2)}</td>
                    <td className="tabular px-3 py-2 text-right">{formatINR(l.unitPrice)}</td>
                    <td className="tabular px-3 py-2 text-right text-slate-600">{l.gstPercent}%</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{formatINR(base + (base * l.gstPercent) / 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="tabular">{formatINR(q.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">GST</dt>
              <dd className="tabular">{formatINR(q.gstTotal)}</dd>
            </div>
            {q.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-600">Discount</dt>
                <dd className="tabular">− {formatINR(q.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
              <dt>Grand total</dt>
              <dd className="tabular">{formatINR(q.grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {(q.terms || q.notes) && (
          <section className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
            {q.terms && (
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Terms & conditions</p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{q.terms}</p>
              </div>
            )}
            {q.notes && (
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Notes</p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{q.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 flex items-end justify-between gap-6 text-xs text-slate-500">
          <p>Prepared by {q.createdBy?.name ?? org.name}</p>
          <div className="text-center">
            <div className="mb-1 h-10 w-44 border-b border-slate-400" />
            For {org.name}
          </div>
        </footer>
      </article>
    </>
  );
}
