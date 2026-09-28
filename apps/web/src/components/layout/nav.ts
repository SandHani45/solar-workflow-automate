import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { Gate } from '@/hooks/use-session';
import { allows } from '@/hooks/use-session';
import type { Session } from '@/lib/types';

export interface NavChild extends Gate {
  label: string;
  href: string;
}

export interface NavItem extends Gate {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Sub-pages; the item links to the first one the user can access. */
  children?: NavChild[];
  section?: 'work' | 'business' | 'admin';
}

export const APP_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:read', section: 'work' },
  { label: 'Leads', href: '/leads', icon: ClipboardList, permission: 'leads:read', feature: 'leads_crm', section: 'work' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, permission: 'projects:read', section: 'work' },
  { label: 'Quotations', href: '/quotations', icon: FileSpreadsheet, permission: 'quotations:read', feature: 'quotations', section: 'work' },
  { label: 'Documents', href: '/documents', icon: FileText, permission: 'documents:read', section: 'work' },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Boxes,
    permission: 'inventory:read',
    feature: 'inventory',
    section: 'business',
    children: [
      { label: 'Items', href: '/inventory' },
      { label: 'Movements', href: '/inventory/movements' },
      { label: 'Summary', href: '/inventory/summary' },
    ],
  },
  { label: 'Dispatches', href: '/dispatches', icon: Truck, permission: 'dispatch:read', feature: 'dispatch', section: 'business' },
  {
    label: 'Finance',
    href: '/finance',
    icon: Wallet,
    anyPermission: ['finance:read', 'payments:read', 'expenses:read'],
    section: 'business',
    children: [
      { label: 'Overview', href: '/finance', permission: 'finance:read', feature: 'finance_dashboard' },
      { label: 'Payments', href: '/finance/payments', permission: 'payments:read' },
      { label: 'Expenses', href: '/finance/expenses', permission: 'expenses:read', feature: 'expenses' },
      { label: 'Advances', href: '/finance/advances', permission: 'finance:read' },
      { label: 'Partners', href: '/finance/partners', permission: 'finance:partners', feature: 'partner_profit_split' },
    ],
  },
  {
    label: 'Service',
    href: '/service',
    icon: Wrench,
    permission: 'tickets:read',
    feature: 'service_tickets',
    section: 'business',
    children: [
      { label: 'Tickets', href: '/service' },
      { label: 'AMC contracts', href: '/service/amc', feature: 'amc_contracts' },
    ],
  },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports:read', section: 'business' },
  {
    label: 'Team',
    href: '/team',
    icon: Users,
    anyPermission: ['users:read', 'roles:manage'],
    section: 'admin',
    children: [
      { label: 'Users', href: '/team', permission: 'users:read' },
      { label: 'Roles & permissions', href: '/team/roles', permission: 'roles:manage' },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    anyPermission: ['settings:manage', 'features:manage', 'workflow:manage'],
    section: 'admin',
    children: [
      { label: 'Organisation', href: '/settings', permission: 'settings:manage' },
      { label: 'Features', href: '/settings/features', permission: 'features:manage' },
      { label: 'Workflow', href: '/settings/workflow', permission: 'workflow:manage' },
    ],
  },
];

export const PLATFORM_NAV: NavItem[] = [
  { label: 'Overview', href: '/platform', icon: Gauge },
  { label: 'Tenants', href: '/platform/tenants', icon: Building2 },
  { label: 'Feature catalogue', href: '/platform/features', icon: Layers },
];

export interface ResolvedNavItem extends NavItem {
  /** The section root used for active matching (href may point at the first allowed child). */
  basePath: string;
}

/** Items (and children) the user can see, each linking to its first accessible child. */
export function resolveNav(session: Session, items: NavItem[] = APP_NAV): ResolvedNavItem[] {
  return items.flatMap((item) => {
    if (!allows(session, item)) return [];
    if (!item.children) return [{ ...item, basePath: item.href }];
    const children = item.children.filter((c) => allows(session, c));
    if (children.length === 0) return [];
    return [{ ...item, basePath: item.href, href: children[0]?.href ?? item.href, children }];
  });
}

export function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
