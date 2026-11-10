"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { Badge, ErrorState, PageHeader, Select, SheetBadge, Tile } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { useApi, useLookups } from "@/lib/hooks";
import type { Offering } from "@/lib/types";

export default function LecturerCoursesPage() {
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [semester, setSemester] = useState<string>("");
  const semesterId = semester || String(lookups?.current_semester?.id ?? "");
  const { data, isLoading, error, refetch } = useApi<Paginated<Offering>>("/lecturer/offerings/", { semester: semesterId, page_size: 100 }, { enabled: !!semesterId });
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <>
      <PageHeader eyebrow="Teaching" title="My courses" description="Courses you are allocated to. You can only see and grade these."
        actions={
          <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="w-56">
            {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}{s.is_current ? " (current)" : ""}</option>)}
          </Select>
        } />
      <Tile className="overflow-hidden">
        <DataTable rows={data?.results} loading={isLoading} onRowClick={(o) => router.push(`/lecturer/courses/${o.id}`)}
          columns={[
            { key: "code", header: "Course", primary: true, cell: (o) => <span><span className="font-mono font-semibold text-primary">{o.course_detail.code}</span> <span className="text-ink">{o.course_detail.title}</span></span> },
            { key: "level", header: "Level", cell: (o) => <Badge>{o.course_detail.level}L</Badge> },
            { key: "units", header: "Units", cell: (o) => o.course_detail.units, align: "center" },
            { key: "students", header: "Students", cell: (o) => o.registered_count, align: "center" },
            { key: "status", header: "Results", cell: (o) => <SheetBadge status={o.result_status} /> },
          ]} />
      </Tile>
    </>
  );
}
