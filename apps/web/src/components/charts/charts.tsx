'use client';

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { useTheme } from '@/providers/theme-provider';
import { formatINR, formatINRCompact, formatNumber } from '@/lib/utils';

/**
 * Categorical series colours, validated (scripts/validate_palette.js) for lightness band,
 * CVD separation and contrast against each theme's surface. Assigned in fixed order.
 */
const PALETTE = {
  light: ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#14b8a6', '#f43f5e'],
  dark: ['#3b82f6', '#d97706', '#059669', '#8b5cf6', '#0d9488', '#e11d48'],
};

export function useChartTheme() {
  const { resolved } = useTheme();
  return {
    series: PALETTE[resolved],
    grid: resolved === 'dark' ? '#1f2a3d' : '#e2e8f0',
    axis: resolved === 'dark' ? '#94a3b8' : '#64748b',
    cursor: resolved === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.08)',
  };
}

type ValueFormat = 'inr' | 'number';
const fmt = (v: number, f: ValueFormat) => (f === 'inr' ? formatINR(v) : formatNumber(v));
const fmtAxis = (v: number, f: ValueFormat) => (f === 'inr' ? formatINRCompact(v) : formatNumber(v));

function ChartTooltip({ active, payload, label, format }: TooltipContentProps<number, string> & { format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: (p.payload as { fill?: string })?.fill ?? p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="tabular ml-auto pl-3 font-medium text-foreground">{fmt(Number(p.value), format)}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = (color: string) => ({ stroke: color, tick: { fill: color, fontSize: 11 }, tickLine: false, axisLine: false });

/** Single-series (or per-bar coloured) bar chart. */
export function SimpleBarChart({
  data,
  xKey,
  yKey,
  name,
  format = 'number',
  colors,
  height = 240,
  layout = 'horizontal',
}: {
  data: object[];
  xKey: string;
  yKey: string;
  name: string;
  format?: ValueFormat;
  /** Per-bar colours (e.g. phase colours); defaults to the first series colour. */
  colors?: string[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
}) {
  const t = useChartTheme();
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, bottom: 0, left: vertical ? 8 : -8 }} barCategoryGap="28%">
        <CartesianGrid stroke={t.grid} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...axisProps(t.axis)} tickFormatter={(v: number) => fmtAxis(v, format)} />
            <YAxis type="category" dataKey={xKey} {...axisProps(t.axis)} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps(t.axis)} interval={0} />
            <YAxis {...axisProps(t.axis)} tickFormatter={(v: number) => fmtAxis(v, format)} width={56} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={{ fill: t.cursor }} content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />} />
        <Bar dataKey={yKey} name={name} fill={t.series[0]} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36}>
          {colors && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two measures in the same unit over time (e.g. received vs expenses). One axis only. */
export function CompareLineChart({ data, xKey, series, format = 'inr', height = 260 }: { data: object[]; xKey: string; series: { key: string; name: string }[]; format?: ValueFormat; height?: number }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps(t.axis)} />
        <YAxis {...axisProps(t.axis)} tickFormatter={(v: number) => fmtAxis(v, format)} width={56} />
        <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.axis }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={t.series[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: t.series[i] }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Donut with a side legend that doubles as the value table. */
export function DonutChart({ data, format = 'inr', height = 220 }: { data: { name: string; value: number }[]; format?: ValueFormat; height?: number }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  // Fold beyond the palette size into "Other" rather than generating hues.
  const max = t.series.length;
  const rows = data.length > max ? [...data.slice(0, max - 1), { name: 'Other', value: data.slice(max - 1).reduce((s, d) => s + d.value, 0) }] : data;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={1.5} stroke="var(--card)" strokeWidth={2}>
              {rows.map((_, i) => (
                <Cell key={i} fill={t.series[i]} />
              ))}
            </Pie>
            <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="tabular text-sm font-semibold">{fmtAxis(total, format)}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: t.series[i] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="tabular font-medium">{fmt(d.value, format)}</span>
            <span className="tabular w-10 text-right text-xs text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
