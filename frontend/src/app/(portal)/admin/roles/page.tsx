"use client";

import { Check, Minus } from "lucide-react";
import { Button, ErrorState, PageHeader, Skeleton, StatTile, Tile, TileHeader } from "@/components/ui";
import { ROLE_HUE } from "@/components/shell";
import { useApi } from "@/lib/hooks";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "university" | "department" | "own";
interface RolesPayload {
  roles: { value: Role; label: string; accounts: number }[];
  capabilities: { area: string; items: { action: string; scope: Partial<Record<Role, Scope>> }[] }[];
}

const ORDER: Role[] = ["SUPER_ADMIN", "DEPT_ADMIN", "LECTURER", "STUDENT"];
const SCOPE_LABEL: Record<Scope, string> = { university: "All", department: "Own dept", own: "Own" };
const DOT: Record<Role, "plum" | "terracotta" | "indigo" | "primary"> = {
  SUPER_ADMIN: "plum", DEPT_ADMIN: "terracotta", LECTURER: "indigo", STUDENT: "primary",
};

export default function RolesPage() {
  const { data, isLoading, error, refetch } = useApi<RolesPayload>("/admin/roles/");
  if (error) return <ErrorState error={error} retry={refetch} />;
  const roles = ORDER.map((r) => data?.roles.find((x) => x.value === r)).filter(Boolean) as RolesPayload["roles"];

  return (
    <>
      <PageHeader eyebrow="Super admin" title="Roles & permissions"
        description="What each role can do and how far its reach extends. Every rule here is enforced by the API, not just hidden in the interface."
        actions={<Button variant="secondary" href="/admin/accounts">Assign roles</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? ORDER.map((r) => <Skeleton key={r} className="h-28" />) :
          roles.map((r) => <StatTile key={r.value} dot={DOT[r.value]} label={r.label} value={r.accounts} hint={r.accounts === 1 ? "account" : "accounts"} />)}
      </div>

      <Tile className="overflow-hidden">
        <TileHeader index="01" title="Permission matrix" subtitle="All = university-wide · Own dept = their department only · Own = their own records or allocated courses" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead className="bg-surface-2">
              <tr className="border-y border-line font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-2.5 text-left font-semibold">Capability</th>
                {ORDER.map((r) => (
                  <th key={r} className="w-32 px-3 py-2.5 text-center font-semibold">
                    <span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", ROLE_HUE[r].dot)} />{r.replace("_", " ").toLowerCase()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-5"><Skeleton className="h-64" /></td></tr>}
              {data?.capabilities.map((g) => (
                <Group key={g.area} area={g.area} items={g.items} />
              ))}
            </tbody>
          </table>
        </div>
      </Tile>
      <p className="mt-3 text-[13px] text-muted">
        Roles are fixed by design: each one maps to a set of server-side permission classes and data scopes, which keeps
        access predictable and testable. Change what a person can do by changing their role or department under All accounts.
      </p>
    </>
  );
}

function Group({ area, items }: RolesPayload["capabilities"][number]) {
  return (
    <>
      <tr className="border-b border-line bg-paper/40"><td colSpan={5} className="px-5 pb-1.5 pt-4 eyebrow">{area}</td></tr>
      {items.map((it) => (
        <tr key={it.action} className="border-b border-line/60 last:border-0">
          <td className="px-5 py-2.5 text-ink">{it.action}</td>
          {ORDER.map((r) => {
            const s = it.scope[r];
            return (
              <td key={r} className="px-3 text-center">
                {s ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">
                    <Check className="size-3.5" /> {SCOPE_LABEL[s]}
                  </span>
                ) : <Minus className="mx-auto size-4 text-line-strong" aria-label="No access" />}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
