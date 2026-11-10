"use client";

import { useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { Badge, ErrorState, PageHeader, Select, SheetBadge, Tile } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useList, useLookups } from "@/lib/hooks";
import type { Registration } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function RegistrationsPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [semester, setSemester] = useState("");
  const [level, setLevel] = useState("");
  const semesterId = semester || String(lookups?.current_semester?.id ?? "");
  const list = useList<Registration>("/admin/registrations/", { semester: semesterId, student__student_profile__level: level, ordering: "-created_at" });
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow={me?.role === "SUPER_ADMIN" ? "University" : me?.department?.name} title="Course registrations"
        description="Every course a student has registered, as recorded by the system." />
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Student, matric no. or course code" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="sm:w-56">
              {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-32">
              <option value="">All levels</option>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </div>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading} dense
          columns={[
            { key: "student", header: "Student", primary: true, cell: (r) => <span><span className="font-medium text-ink">{r.student_name}</span> <span className="font-mono text-[12px] text-muted">{r.matric_number}</span></span> },
            { key: "level", header: "Level", cell: (r) => <Badge>{r.student_level}L</Badge> },
            { key: "course", header: "Course", cell: (r) => <span><span className="font-mono font-semibold text-primary">{r.course_code}</span> <span className="hidden lg:inline">{r.course_title}</span></span> },
            { key: "units", header: "Units", align: "center", cell: (r) => r.units },
            { key: "result", header: "Result sheet", cell: (r) => <SheetBadge status={r.result_status} />, mobileHidden: true },
            { key: "when", header: "Registered", cell: (r) => <span className="text-muted">{formatDate(r.created_at, true)}</span> },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
    </>
  );
}
