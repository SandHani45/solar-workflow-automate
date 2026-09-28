import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { formatINR as sharedFormatINR, humanize } from '@solar/shared';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const formatINR = sharedFormatINR;
export { humanize };

/** Compact rupee format for KPI tiles: ₹12.4L, ₹1.2Cr. */
export function formatINRCompact(n: number | null | undefined): string {
  const v = n ?? 0;
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return sharedFormatINR(v);
}

export function formatNumber(n: number | null | undefined, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: fractionDigits }).format(n ?? 0);
}

export function formatKw(n: number | null | undefined): string {
  return `${formatNumber(n, 2)} kW`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy'): string {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'd MMM yyyy, h:mm a');
}

export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : '—';
}

/** `YYYY-MM-DD` for <input type="date">. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'yyyy-MM-dd') : '';
}

export function formatMonth(month: string): string {
  const d = toDate(`${month}-01`);
  return d ? format(d, 'MMM yy') : month;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function formatAddress(address: { line1?: string; city?: string; district?: string; state?: string; pincode?: string } | string | null | undefined): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.line1, address.city, address.district, address.state, address.pincode].filter(Boolean).join(', ');
}

/** Drop empty strings / undefined so optional zod fields validate and the API gets clean payloads. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)) as Partial<T>;
}
