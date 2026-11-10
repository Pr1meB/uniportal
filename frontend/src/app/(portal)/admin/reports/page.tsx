"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Segmented, Select, StatTile, Tile, TileHeader } from "@/components/ui";
import { Bars } from "@/components/charts";
import { useMe } from "@/lib/auth";
import { useApi, useLookups } from "@/lib/hooks";
import { downloadCsv, num } from "@/lib/utils";

interface PerfRow { code: string; title: string; units: number; level: number; department: string; students: number; average: number | null; pass_rate: number | null }
interface RegRow { code: string; title: string; units: number; level: number; department: string; registered: number; capacity: number | null; lecturers: string | null }
interface RegReport { totals: { registrations: number; students: number; courses: number }; by_level: { level: number; students: number; registrations: number; units: number }[]; courses: RegRow[] }
type Tab = "registrations" | "performance" | "standing";
interface StandingRow { id: number; name: string; matric_number: string; program: string; level: number; department: string; units: number; cgpa: string | number | null }

export default function ReportsPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [tab, setTab] = useState<Tab>("registrations");
  const [semester, setSemester] = useState("");
  const [regSemester, setRegSemester] = useState("");
  const [level, setLevel] = useState("");
  // Default to the last completed semester (the one listed just after the current one).
  const sems = lookups?.semesters ?? [];
  const currentIdx = sems.findIndex((s) => s.is_current);
  const defaultSemester = sems[currentIdx + 1] ?? sems[currentIdx];
  const semesterId = semester || String(defaultSemester?.id ?? "");
  const regSemesterId = regSemester || String(sems[currentIdx]?.id ?? "");
  const regs = useApi<RegReport>(tab === "registrations" ? "/admin/reports/registrations/" : null, { semester: regSemesterId }, { enabled: !!regSemesterId });
  const perf = useApi<{ courses: PerfRow[] }>(tab === "performance" ? "/admin/reports/performance/" : null, { semester: semesterId }, { enabled: !!semesterId });
  const standing = useApi<StandingRow[]>(tab === "standing" ? "/admin/reports/standing/" : null, { level });
  const err = perf.error || standing.error || regs.error;
  const exportCsv = () => {
    if (tab === "registrations") downloadCsv((regs.data?.courses ?? []) as never, "course-registrations.csv");
    else if (tab === "performance") downloadCsv((perf.data?.courses ?? []) as never, "course-performance.csv");
    else downloadCsv((standing.data ?? []) as never, "student-list.csv");
  };
  if (err) return <ErrorState error={err} />;

  return (
    <>
      <PageHeader eyebrow={me?.role === "SUPER_ADMIN" ? "University-wide" : me?.department?.name} title="Reports"
        description="Registrations, academic performance and student lists. Performance and CGPA use approved results only."
        actions={<>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> CSV
          </Button>
        </>} />
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented value={tab} onChange={setTab} options={[{ value: "registrations", label: "Registrations" }, { value: "performance", label: "Performance" }, { value: "standing", label: "Student list" }]} />
        {tab === "registrations" ? (
          <Select value={regSemesterId} onChange={(e) => setRegSemester(e.target.value)} className="sm:w-60">
            {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        ) : tab === "performance" ? (
          <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="sm:w-60">
            {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        ) : (
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-40">
            <option value="">All levels</option>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        )}
      </div>
      {tab === "registrations" && <RegistrationSummary data={regs.data} />}
      <Tile className="overflow-hidden">
        {tab === "registrations" ? (
          <DataTable rows={regs.data?.courses} loading={regs.isLoading} rowKey={(r) => r.code}
            empty={<EmptyState title="No courses offered in this semester" />}
            columns={[
              { key: "code", header: "Course", primary: true, cell: (r) => <span><span className="font-mono font-semibold text-primary">{r.code}</span> {r.title}</span> },
              { key: "dept", header: "Dept", cell: (r) => r.department, mobileHidden: true },
              { key: "level", header: "Level", cell: (r) => <Badge>{r.level}L</Badge> },
              { key: "units", header: "Units", align: "center", cell: (r) => r.units, mobileHidden: true },
              { key: "lect", header: "Lecturer(s)", cell: (r) => r.lecturers ?? <Badge tone="warn">Unallocated</Badge>, mobileHidden: true },
              { key: "reg", header: "Registered", align: "right", cell: (r) => (
                <span className="tabular"><span className="font-semibold text-ink">{r.registered}</span><span className="text-muted"> / {r.capacity ?? "∞"}</span></span>
              ) },
            ]} />
        ) : tab === "performance" ? (
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

function RegistrationSummary({ data }: { data?: RegReport }) {
  const levels = (data?.by_level ?? []).map((l) => ({ level: `${l.level}L`, students: l.students }));
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.6fr]">
      <StatTile dot="primary" label="Registrations" value={data?.totals.registrations ?? "–"} hint="course registrations" />
      <StatTile dot="indigo" label="Students" value={data?.totals.students ?? "–"} hint="registered at least one course" />
      <StatTile dot="saffron" label="Courses offered" value={data?.totals.courses ?? "–"} hint="this semester" />
      <Tile className="no-print">
        <TileHeader title="Students by level" />
        <div className="px-3 pb-2"><Bars data={levels} x="level" y="students" height={110} emphasiseMax /></div>
      </Tile>
    </div>
  );
}
