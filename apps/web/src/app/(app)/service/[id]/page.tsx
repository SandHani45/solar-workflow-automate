'use client';

import { useParams } from 'next/navigation';
import { useTicket } from '@/hooks/api/use-service';
import { Require } from '@/components/auth/require';
import { TicketDetail } from '@/components/service/ticket-detail';
import { PageHeader } from '@/components/ui/page-header';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useTicket(id);
  return (
    <Require permission="tickets:read" feature="service_tickets">
      <PageHeader title={data?.subject ?? 'Ticket'} breadcrumbs={[{ label: 'Service', href: '/service' }, { label: data?.code ?? '…' }]} />
      <TicketDetail id={id} />
    </Require>
  );
}
