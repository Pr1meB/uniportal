"use client";

import { GraduationCap, Info, Printer } from "lucide-react";
import { useState } from "react";
import { Button, EmptyState, ErrorState, GradePill, PageHeader, Segmented, Skeleton, StatTile, Tile } from "@/components/ui";
import { useApi, useLookups } from "@/lib/hooks";
import type { Transcript } from "@/lib/types";
import { num } from "@/lib/utils";

export default function StudentResultsPage() {
  const { data, isLoading, error, refetch } = useApi<Transcript>("/student/results/");
  const { data: lookups } = useLookups();
  const [view, setView] = useState<"semester" | "all">("semester");
  if (error) return <ErrorState error={error} retry={refetch} />;

  const semesters = [...(data?.semesters ?? [])].reverse();

  return (
    <>
      <PageHeader eyebrow="Academic record" title="Results & CGPA"
        description="Only results approved by your department appear here."
        actions={data?.semesters.length ? <Button variant="secondary" href="/print/results"><Printer className="size-4" /> Result statement</Button> : null} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile tone="primary" label="CGPA" value={num(data?.cgpa)} hint={data?.degree_class} />
        <StatTile dot="indigo" label="Units taken" value={data?.total_units ?? "–"} />
        <StatTile dot="saffron" label="Units passed" value={data?.units_passed ?? "–"} />
        <StatTile dot="plum" label="Semesters" value={data?.semesters.length ?? "–"} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Semester breakdown</h2>
        <Segmented value={view} onChange={setView} options={[{ value: "semester", label: "By semester" }, { value: "all", label: "All courses" }]} />
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-4"><Skeleton className="h-60" /><Skeleton className="h-60" /></div>
      ) : !semesters.length ? (
        <Tile className="mt-4"><EmptyState icon={<GraduationCap className="size-5" />} title="No approved results yet"
          description="Once your lecturers’ results are approved by the department, they’ll show up here." /></Tile>
      ) : view === "semester" ? (
        <div className="mt-4 space-y-4">
          {semesters.map((s) => (
            <Tile key={s.semester_id} className="overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
                <div>
                  <div className="eyebrow">{s.session}</div>
                  <div className="font-display text-2xl">{s.term === "FIRST" ? "First" : "Second"} Semester</div>
                </div>
                <div className="flex gap-6 text-right">
                  <div><div className="eyebrow">GPA</div><div className="font-display text-3xl tabular">{num(s.gpa)}</div></div>
                  <div><div className="eyebrow">CGPA</div><div className="font-display text-3xl tabular text-primary">{num(s.cgpa)}</div></div>
                </div>
              </div>
              <ResultTable courses={s.courses} />
              <div className="flex justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
                <span>{s.units} units registered</span><span>{s.units_passed} units passed</span>
              </div>
            </Tile>
          ))}
        </div>
      ) : (
        <Tile className="mt-4 overflow-hidden">
          <ResultTable courses={semesters.flatMap((s) => s.courses)} />
        </Tile>
      )}

      {lookups && (
        <Tile className="mt-6 p-5">
          <div className="flex items-center gap-2 text-[14px] font-medium"><Info className="size-4 text-muted" /> Grading scale</div>
          <p className="mt-1 text-[13px] text-muted">
            CA is out of {lookups.grading.ca_max}, exam out of {lookups.grading.exam_max}. GPA = Σ(units × grade point) ÷ Σ units.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lookups.grading.bands.map((b) => (
              <span key={b.grade} className="rounded-xl border border-line px-3 py-1.5 text-[13px]">
                <span className="font-semibold">{b.grade}</span> <span className="text-muted">{Number(b.min_score)}–{Math.round(Number(b.max_score))} · {Number(b.point)} pts</span>
              </span>
            ))}
          </div>
        </Tile>
      )}
    </>
  );
}

function ResultTable({ courses }: { courses: Transcript["semesters"][number]["courses"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
            <th className="px-5 py-2.5 text-left font-semibold">Course</th>
            <th className="px-3 py-2.5 text-center font-semibold">Units</th>
            <th className="px-3 py-2.5 text-center font-semibold">CA</th>
            <th className="px-3 py-2.5 text-center font-semibold">Exam</th>
            <th className="px-3 py-2.5 text-center font-semibold">Total</th>
            <th className="px-5 py-2.5 text-center font-semibold">Grade</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c, i) => (
            <tr key={c.code + i} className="border-b border-line/60 last:border-0">
              <td className="px-5 py-3"><span className="font-mono text-[12px] font-semibold text-primary">{c.code}</span><div className="text-ink">{c.title}</div></td>
              <td className="px-3 text-center tabular">{c.units}</td>
              <td className="px-3 text-center tabular text-muted">{num(c.ca_score, 0)}</td>
              <td className="px-3 text-center tabular text-muted">{num(c.exam_score, 0)}</td>
              <td className="px-3 text-center font-medium tabular">{num(c.total, 0)}</td>
              <td className="px-5 text-center"><GradePill grade={c.grade} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
