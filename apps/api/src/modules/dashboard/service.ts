import { PHASES, roundMoney } from '@solar/shared';
import { can, hasFeature, sameId, type Ctx } from '../../lib/context';
import type { Filter } from '../../lib/mongoose';
import { BUSINESS_TZ, lastMonthKeys, monthStart, startOfToday } from '../../lib/time';
import { AuditLog } from '../audit/model';
import { signedPaymentAmount } from '../finance/calc';
import { lowStockCount } from '../inventory/service';
import { Lead } from '../leads/model';
import { leadScope } from '../leads/service';
import { Payment } from '../payments/model';
import { projectScope, visibleProjectIds } from '../projects/access';
import { Project } from '../projects/model';
import { openTicketCount } from '../tickets/service';
import { USER_REF } from '../users/model';

const OPEN_STAGE = ['pending', 'in_progress', 'blocked'];

export async function activityFor(ctx: Ctx, limit = 15, extra: Filter = {}) {
  const filter: Filter = { orgId: ctx.orgOid, ...extra };
  if (!can(ctx, 'audit:read') && !can(ctx, 'projects:read_all')) {
    const ids = (await visibleProjectIds(ctx)) ?? [];
    filter.$or = [{ projectId: { $in: ids } }, { userId: ctx.userOid }];
  }
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('userId', USER_REF).lean();
  return rows.map(({ userId, ...r }: any) => ({ ...r, user: userId && userId._id ? userId : null }));
}

export async function dashboard(ctx: Ctx) {
  const now = new Date();
  const monthBegin = monthStart(now);
  const scope = projectScope(ctx);
  const projects = await Project.find({ ...scope, status: { $in: ['active', 'on_hold'] } })
    .select('code customer.name status currentPhase contractValue stages stageDefinitions installationDate team.engineer')
    .populate('team.engineer', USER_REF)
    .lean();
  const active = projects.filter((p) => p.status === 'active');

  const finance = can(ctx, 'payments:read');
  const [completedThisMonth, newLeads, collected, openTickets, lowStock, monthly] = await Promise.all([
    Project.countDocuments({ ...scope, status: 'completed', completedAt: { $gte: monthBegin } }),
    can(ctx, 'leads:read') && hasFeature(ctx, 'leads_crm') ? Lead.countDocuments({ ...leadScope(ctx), createdAt: { $gte: monthBegin } }) : Promise.resolve(0),
    finance
      ? Payment.aggregate<{ total: number }>([
          { $match: { orgId: ctx.orgOid, deletedAt: null, receivedAt: { $gte: monthBegin }, ...(await visibleFilter(ctx)) } },
          { $group: { _id: null, total: { $sum: signedPaymentAmount } } },
        ])
      : Promise.resolve([]),
    can(ctx, 'tickets:read') && hasFeature(ctx, 'service_tickets') ? openTicketCount(ctx) : Promise.resolve(0),
    can(ctx, 'inventory:read') && hasFeature(ctx, 'inventory') ? lowStockCount(ctx.orgOid) : Promise.resolve(0),
    can(ctx, 'finance:read')
      ? Payment.aggregate<{ _id: string; amount: number }>([
          { $match: { orgId: ctx.orgOid, deletedAt: null, receivedAt: { $gte: monthStart(now, 5) } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$receivedAt', timezone: BUSINESS_TZ } }, amount: { $sum: signedPaymentAmount } } },
        ])
      : Promise.resolve(null),
  ]);

  let overdueStages = 0;
  const myTasks: {
    projectId: string;
    projectCode: string;
    customerName: string;
    stageKey: string;
    stageName: string;
    phase?: string;
    status: string;
    dueAt: Date | null;
    overdue: boolean;
  }[] = [];
  for (const p of active) {
    for (const s of p.stages) {
      if (!OPEN_STAGE.includes(s.status)) continue;
      const overdue = !!s.dueAt && s.dueAt.getTime() < now.getTime();
      if (overdue) overdueStages++;
      const def = p.stageDefinitions.find((d) => d.key === s.key);
      if (!def) continue;
      if (def.ownerRoles.includes(ctx.roleKey) || sameId(s.assignee, ctx.userId)) {
        myTasks.push({
          projectId: String(p._id),
          projectCode: p.code,
          customerName: p.customer?.name,
          stageKey: s.key,
          stageName: def.name,
          phase: def.phase,
          status: s.status,
          dueAt: s.dueAt ?? null,
          overdue,
        });
      }
    }
  }
  myTasks.sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));

  const today = startOfToday(now);
  const upcomingInstallations = active
    .filter((p) => p.installationDate && p.installationDate.getTime() >= today.getTime() && p.stages.some((s) => s.key === 'installation' && s.status !== 'completed'))
    .sort((a, b) => a.installationDate!.getTime() - b.installationDate!.getTime())
    .slice(0, 10)
    .map((p) => ({ projectId: String(p._id), projectCode: p.code, customerName: p.customer?.name, date: p.installationDate, engineer: (p.team?.engineer as unknown) ?? undefined }));

  const byMonth = new Map((monthly ?? []).map((m) => [m._id, roundMoney(m.amount)]));
  return {
    kpis: {
      activeProjects: active.length,
      completedThisMonth,
      newLeads,
      pipelineValue: roundMoney(active.reduce((s, p) => s + (p.contractValue ?? 0), 0)),
      collectedThisMonth: roundMoney(collected[0]?.total ?? 0),
      openTickets,
      overdueStages,
      lowStockItems: lowStock,
    },
    projectsByPhase: PHASES.map((ph) => ({ phase: ph.key, count: active.filter((p) => p.currentPhase === ph.key).length })),
    myTasks: myTasks.slice(0, 50),
    recentActivity: await activityFor(ctx, 15),
    upcomingInstallations,
    monthlyCollections: monthly ? lastMonthKeys(6).map((month) => ({ month, amount: byMonth.get(month) ?? 0 })) : [],
  };
}

async function visibleFilter(ctx: Ctx): Promise<Filter> {
  const ids = await visibleProjectIds(ctx);
  return ids ? { projectId: { $in: ids } } : {};
}
