"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { EmptyState, ErrorState, PageHeader, Segmented, Select, SheetBadge, Tile } from "@/components/ui";
import { useList, useLookups } from "@/lib/hooks";
import type { Sheet } from "@/lib/types";
import { num, timeAgo } from "@/lib/utils";

const TABS = [
  { value: "SUBMITTED", label: "Awaiting review" },
  { value: "REJECTED", label: "Returned" },
  { value: "APPROVED", label: "Approved" },
  { value: "DRAFT", label: "Drafts" },
];

function ResultsQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: lookups } = useLookups();
  const [status, setStatus] = useState(params.get("status") ?? "SUBMITTED");
  const [semester, setSemester] = useState("");
  const semesterId = semester || String(lookups?.current_semester?.id ?? "");
  const list = useList<Sheet>("/admin/result-sheets/", { status, offering__semester: semesterId });
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow="Workflow" title="Result approvals"
        description="Review lecturers’ submissions. Approved results become visible to students; returned sheets go back to the lecturer with your feedback." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto"><Segmented value={status} onChange={setStatus} options={TABS} /></div>
        <div className="flex gap-2">
          <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="w-52">
            {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Course code or title" />
        </div>
      </div>
      <Tile className="overflow-hidden">
        <DataTable rows={list.data?.results} loading={list.isLoading} onRowClick={(s) => router.push(`/admin/results/${s.id}`)}
          empty={<EmptyState icon={<ClipboardCheck className="size-5" />} title="Queue is clear" description="No result sheets in this state." />}
          columns={[
            { key: "course", header: "Course", primary: true, cell: (s) => <span><span className="font-mono font-semibold text-primary">{s.offering.course_detail.code}</span> <span className="text-ink">{s.offering.course_detail.title}</span></span> },
            { key: "dept", header: "Dept", cell: (s) => s.offering.course_detail.department_name, mobileHidden: true },
            { key: "lecturer", header: "Lecturer", cell: (s) => s.submitted_by_name ?? s.offering.lecturer_details.map((l) => l.full_name).join(", ") },
            { key: "students", header: "Students", align: "center", cell: (s) => s.student_count },
            { key: "avg", header: "Average", align: "center", cell: (s) => num(s.average, 1) },
            { key: "pass", header: "Pass rate", align: "center", cell: (s) => (s.student_count ? `${Math.round(((s.pass_count ?? 0) / s.student_count) * 100)}%` : "—") },
            { key: "status", header: "Status", cell: (s) => <SheetBadge status={s.status} /> },
            { key: "when", header: "Updated", cell: (s) => <span className="text-muted">{timeAgo(s.submitted_at ?? s.updated_at)}</span> },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
    </>
  );
}

export default function Page() {
  return <Suspense><ResultsQueue /></Suspense>;
}
