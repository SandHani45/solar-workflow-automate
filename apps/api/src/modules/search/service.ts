import { can, hasFeature, type Ctx } from '../../lib/context';
import { searchRegex } from '../../lib/pagination';
import { Lead } from '../leads/model';
import { leadScope } from '../leads/service';
import { projectScope } from '../projects/access';
import { Project } from '../projects/model';
import { Ticket } from '../tickets/model';
import { ticketScope } from '../tickets/service';

/** Global search across projects, leads and tickets (≤5 each, permission + feature filtered). */
export async function globalSearch(ctx: Ctx, q: string) {
  const term = q.trim();
  if (term.length < 2) return { projects: [], leads: [], tickets: [] };
  const rx = searchRegex(term);
  const [projects, leads, tickets] = await Promise.all([
    can(ctx, 'projects:read')
      ? Project.find({ ...projectScope(ctx), $and: [{ $or: [{ code: rx }, { 'customer.name': rx }, { 'customer.phone': rx }, { 'customer.consumerNumber': rx }] }] })
          .select('code customer.name customer.phone status currentPhase progress')
          .sort({ updatedAt: -1 })
          .limit(5)
          .lean()
      : [],
    can(ctx, 'leads:read') && hasFeature(ctx, 'leads_crm')
      ? Lead.find({ ...leadScope(ctx), $and: [{ $or: [{ code: rx }, { name: rx }, { phone: rx }, { email: rx }] }] })
          .select('code name phone status')
          .sort({ updatedAt: -1 })
          .limit(5)
          .lean()
      : [],
    can(ctx, 'tickets:read') && hasFeature(ctx, 'service_tickets')
      ? Ticket.find({ ...(await ticketScope(ctx)), $and: [{ $or: [{ code: rx }, { subject: rx }] }] })
          .select('code subject status priority projectId')
          .sort({ updatedAt: -1 })
          .limit(5)
          .lean()
      : [],
  ]);
  return {
    projects: projects.map((p) => ({ id: p._id, code: p.code, customerName: p.customer?.name, phone: p.customer?.phone, status: p.status, currentPhase: p.currentPhase, progress: p.progress })),
    leads,
    tickets,
  };
}
