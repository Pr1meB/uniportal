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
