/**
 * Money is stored as rupees with 2-decimal precision (not integer paise) to keep
 * data readable in reports; every write and aggregate goes through `roundMoney`.
 */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface QuotationLine {
  description: string;
  quantity: number;
  unitPrice: number;
  /** GST percent for this line, e.g. 12 for modules/inverter, 18 for services. */
  gstPercent: number;
  itemId?: string;
}

export interface QuotationTotals {
  subtotal: number;
  gstTotal: number;
  discount: number;
  grandTotal: number;
}

export function computeQuotationTotals(lines: QuotationLine[], discount = 0): QuotationTotals {
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const gstTotal = roundMoney(lines.reduce((s, l) => s + (l.quantity * l.unitPrice * l.gstPercent) / 100, 0));
  const grandTotal = roundMoney(Math.max(0, subtotal + gstTotal - discount));
  return { subtotal, gstTotal, discount: roundMoney(discount), grandTotal };
}

export interface Partner {
  name: string;
  sharePercent: number;
  userId?: string;
}

export interface ProfitInputs {
  /** Money actually received (payments, excluding refunds). */
  received: number;
  /** Approved expenses. */
  expenses: number;
  /** Cost of material consumed (stock issued to projects, at cost price). */
  materialCost: number;
}

export interface ProfitSplitRow {
  name: string;
  sharePercent: number;
  share: number;
  advanceTaken: number;
  netPayable: number;
}

export function computeProfit({ received, expenses, materialCost }: ProfitInputs): number {
  return roundMoney(received - expenses - materialCost);
}

/** Split profit between partners and net off advances each partner has already taken. */
export function splitProfit(profit: number, partners: Partner[], advancesByName: Record<string, number> = {}): ProfitSplitRow[] {
  return partners.map((p) => {
    const share = roundMoney((profit * p.sharePercent) / 100);
    const advanceTaken = roundMoney(advancesByName[p.name] ?? 0);
    return { name: p.name, sharePercent: p.sharePercent, share, advanceTaken, netPayable: roundMoney(share - advanceTaken) };
  });
}

export function partnersShareValid(partners: Partner[]): boolean {
  const total = partners.reduce((s, p) => s + p.sharePercent, 0);
  return partners.length === 0 || Math.abs(total - 100) < 0.01;
}

export function formatINR(n: number | undefined | null): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);
}
