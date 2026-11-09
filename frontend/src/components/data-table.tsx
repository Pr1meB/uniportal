"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState, Input, Skeleton } from "@/components/ui";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** shown as the card title on mobile */
  primary?: boolean;
  /** hide from the mobile card */
  mobileHidden?: boolean;
  align?: "left" | "right" | "center";
}

/**
 * Renders a proper table from md upward and a stacked card list on phones,
 * from the same column definitions.
 */
export function DataTable<T>({
  columns, rows, loading, empty, onRowClick, rowKey, dense,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string | number;
  dense?: boolean;
}) {
  const keyOf = (r: T, i: number) => (rowKey ? rowKey(r) : ((r as { id?: number | string }).id ?? i));
  if (loading)
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
      </div>
    );
  if (!rows?.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.mobileHidden);
  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted", align(c.align), c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={keyOf(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-b border-line/70 last:border-0 transition-colors", onRowClick && "cursor-pointer hover:bg-surface-2")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-5 text-ink-2", dense ? "py-2" : "py-3.5", align(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row, i) => (
          <li key={keyOf(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("px-4 py-3.5", onRowClick && "active:bg-surface-2")}>
            <div className="font-medium text-ink">{primary.cell(row)}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {rest.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-muted">{c.header}</dt>
                  <dd className="mt-0.5 truncate text-[13px] text-ink-2">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
