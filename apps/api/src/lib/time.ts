/**
 * Month bucketing for dashboards happens in the business timezone (India), so a payment
 * received at 00:30 IST on the 1st counts towards the new month.
 */
export const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Asia/Kolkata';

function parts(date: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of BUSINESS_TZ from UTC at `date`, in ms. */
function offsetMs(date: Date): number {
  const p = parts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

export const monthKey = (date: Date): string => {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

/** Start of the month (in BUSINESS_TZ) that is `back` months before `now`, as a UTC instant. */
export function monthStart(now = new Date(), back = 0): Date {
  const p = parts(now);
  const d = new Date(Date.UTC(p.year, p.month - 1 - back, 1));
  return new Date(d.getTime() - offsetMs(d));
}

/** Oldest-first list of the last `n` month keys, ending with the current month. */
export function lastMonthKeys(n: number, now = new Date()): string[] {
  const p = parts(now);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function startOfToday(now = new Date()): Date {
  const p = parts(now);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return new Date(d.getTime() - offsetMs(d));
}
