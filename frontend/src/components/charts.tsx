"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--ink)" },
  labelStyle: { color: "var(--muted)" },
  cursor: { fill: "var(--paper-2)" },
};

export function GpaTrend({ data }: { data: { label: string; gpa: number | null; cgpa: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="1 4" vertical={false} />
        <XAxis dataKey="short" {...axis} />
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axis} />
        <Tooltip {...tooltipStyle} formatter={(v) => Number(v).toFixed(2)} labelFormatter={(_, p) => p?.[0]?.payload?.label} />
        <Line type="monotone" dataKey="gpa" name="GPA" stroke="var(--terracotta)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={{ r: 4, fill: "var(--terracotta)", strokeWidth: 0 }} />
        <Line type="monotone" dataKey="cgpa" name="CGPA" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5, fill: "var(--surface)", stroke: "var(--primary)", strokeWidth: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ActivityArea({ data }: { data: { day: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="act" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" {...axis} tickFormatter={(d) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey="count" name="Actions" stroke="var(--primary)" strokeWidth={2} fill="url(#act)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Single-hue bars. `highlight` picks bars to flag in terracotta (e.g. F grades);
 * with `emphasiseMax` the largest bar is solid and the rest are a quiet tint.
 */
export function Bars({ data, x, y, height = 200, highlight, emphasiseMax }: {
  data: Record<string, unknown>[]; x: string; y: string; height?: number;
  highlight?: (d: Record<string, unknown>) => boolean; emphasiseMax?: boolean;
}) {
  const max = Math.max(0, ...data.map((d) => Number(d[y]) || 0));
  const quiet = "color-mix(in srgb, var(--primary) 32%, var(--surface))";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="1 4" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={y} radius={[10, 10, 3, 3]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={
              highlight?.(d) ? "var(--terracotta)"
                : emphasiseMax ? (Number(d[y]) === max && max > 0 ? "var(--primary)" : quiet)
                : "var(--primary)"
            } />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pointillist pipeline: one dot per result sheet, coloured by workflow state. */
export function Pipeline({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      {/* pointillist pipeline: one dot per course sheet (capped), coloured by state */}
      <div className={total <= 24 ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-[4px]"}>
        {parts.flatMap((p) => Array.from({ length: Math.round((p.value / total) * Math.min(total, 60)) }, (_, i) => (
          <span key={p.label + i} className={total <= 24 ? "size-4 rounded-full" : "size-[9px] rounded-full"} style={{ background: p.color }} title={`${p.label}: ${p.value}`} />
        )))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</span>
            <span className="font-medium tabular">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
