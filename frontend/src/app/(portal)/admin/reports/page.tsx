"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { Badge, Button, ErrorState, PageHeader, Segmented, Select, Tile } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi, useLookups } from "@/lib/hooks";
import { num } from "@/lib/utils";

interface PerfRow { code: string; title: string; units: number; level: number; department: string; students: number; average: number | null; pass_rate: number | null }
interface StandingRow { id: number; name: string; matric_number: string; program: string; level: number; department: string; units: number; cgpa: string | number | null }

function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [tab, setTab] = useState<"performance" | "standing">("performance");
  const [semester, setSemester] = useState("");
  const [level, setLevel] = useState("");
  // Default to the last completed semester (the one listed just after the current one).
  const sems = lookups?.semesters ?? [];
  const currentIdx = sems.findIndex((s) => s.is_current);
  const defaultSemester = sems[currentIdx + 1] ?? sems[currentIdx];
  const semesterId = semester || String(defaultSemester?.id ?? "");
  const perf = useApi<{ courses: PerfRow[] }>(tab === "performance" ? "/admin/reports/performance/" : null, { semester: semesterId }, { enabled: !!semesterId });
  const standing = useApi<StandingRow[]>(tab === "standing" ? "/admin/reports/standing/" : null, { level });
  const err = perf.error || standing.error;
  if (err) return <ErrorState error={err} />;

  return (
    <>
      <PageHeader eyebrow={me?.role === "SUPER_ADMIN" ? "University-wide" : me?.department?.name} title="Reports"
        description="Built from approved results only."
        actions={<>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button variant="secondary" onClick={() => tab === "performance" ? toCsv((perf.data?.courses ?? []) as never, "course-performance.csv") : toCsv((standing.data ?? []) as never, "student-standing.csv")}>
            <Download className="size-4" /> CSV
          </Button>
        </>} />
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented value={tab} onChange={setTab} options={[{ value: "performance", label: "Course performance" }, { value: "standing", label: "Student standing" }]} />
        {tab === "performance" ? (
          <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="sm:w-60">
            {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        ) : (
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-40">
            <option value="">All levels</option>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        )}
      </div>
      <Tile className="overflow-hidden">
        {tab === "performance" ? (
          <DataTable rows={perf.data?.courses} loading={perf.isLoading} rowKey={(r) => r.code}
            columns={[
              { key: "code", header: "Course", primary: true, cell: (r) => <span><span className="font-mono font-semibold text-primary">{r.code}</span> {r.title}</span> },
              { key: "dept", header: "Dept", cell: (r) => r.department },
              { key: "level", header: "Level", cell: (r) => <Badge>{r.level}L</Badge> },
              { key: "students", header: "Students", align: "center", cell: (r) => r.students },
              { key: "avg", header: "Average", align: "center", cell: (r) => num(r.average, 1) },
              { key: "pass", header: "Pass rate", align: "right", cell: (r) => (
                <div className="flex items-center justify-end gap-2">
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-paper-2 sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${r.pass_rate ?? 0}%` }} /></div>
                  <span className="tabular">{r.pass_rate ?? "—"}%</span>
                </div>
              ) },
            ]} />
        ) : (
          <DataTable rows={standing.data} loading={standing.isLoading} dense
            columns={[
              { key: "rank", header: "#", cell: (r) => <span className="text-muted tabular">{(standing.data?.indexOf(r) ?? 0) + 1}</span>, mobileHidden: true },
              { key: "name", header: "Student", primary: true, cell: (r) => <span><span className="font-medium text-ink">{r.name}</span> <span className="font-mono text-[12px] text-muted">{r.matric_number}</span></span> },
              { key: "program", header: "Program", cell: (r) => r.program },
              { key: "level", header: "Level", cell: (r) => <Badge>{r.level}L</Badge> },
              { key: "units", header: "Units", align: "center", cell: (r) => r.units },
              { key: "cgpa", header: "CGPA", align: "right", cell: (r) => <span className="font-display text-xl">{num(r.cgpa)}</span> },
            ]} />
        )}
      </Tile>
    </>
  );
}
