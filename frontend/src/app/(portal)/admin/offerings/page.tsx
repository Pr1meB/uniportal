"use client";

import { Layers, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { Badge, Button, Dialog, EmptyState, ErrorState, PageHeader, Select, SheetBadge, Tile } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useApi, useList, useLookups } from "@/lib/hooks";
import type { Offering } from "@/lib/types";

interface LecturerOption { id: number; full_name: string; department: number; profile: { title: string; staff_id: string }; course_count: number }

export default function OfferingsPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [semester, setSemester] = useState("");
  const [level, setLevel] = useState("");
  const semesterId = semester || String(lookups?.current_semester?.id ?? "");
  const list = useList<Offering>("/admin/offerings/", { semester: semesterId, course__level: level });
  const [allocating, setAllocating] = useState<Offering | null>(null);
  const bulk = useAction("POST", "/admin/offerings/bulk-offer/", { success: (r) => `${(r as { created: number }).created} course(s) offered.` });
  const isCurrent = semesterId === String(lookups?.current_semester?.id ?? "");
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow={me?.role === "SUPER_ADMIN" ? "University" : me?.department?.name} title="Offerings & allocation"
        description="Courses running this semester and the lecturers allocated to teach them. Lecturers only see courses allocated here."
        actions={isCurrent && <Button variant="secondary" loading={bulk.isPending} onClick={() => bulk.mutate(undefined)}><Layers className="size-4" /> Offer all active courses</Button>} />
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Course code or title" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={semesterId} onChange={(e) => setSemester(e.target.value)} className="sm:w-56">
              {lookups?.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-32">
              <option value="">All levels</option>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </div>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading}
          empty={<EmptyState title="No courses offered" description="Use “Offer all active courses” to open this semester’s catalogue." />}
          columns={[
            { key: "course", header: "Course", primary: true, cell: (o) => <span><span className="font-mono font-semibold text-primary">{o.course_detail.code}</span> <span className="text-ink">{o.course_detail.title}</span></span> },
            { key: "level", header: "Level", cell: (o) => <Badge>{o.course_detail.level}L</Badge> },
            { key: "lecturers", header: "Lecturer(s)", cell: (o) => o.lecturer_details.length ? o.lecturer_details.map((l) => l.full_name).join(", ") : <Badge tone="danger">Unallocated</Badge> },
            { key: "students", header: "Students", align: "center", cell: (o) => o.registered_count },
            { key: "results", header: "Results", cell: (o) => <SheetBadge status={o.result_status} /> },
            { key: "act", header: "", align: "right" as const, cell: (o) => <Button size="sm" variant="secondary" onClick={() => setAllocating(o)}><UserPlus className="size-4" /> Allocate</Button> },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
      <AllocateDialog offering={allocating} onClose={() => setAllocating(null)} />
    </>
  );
}

function AllocateDialog({ offering, onClose }: { offering: Offering | null; onClose: () => void }) {
  const dept = offering?.course_detail.department;
  const { data } = useApi<Paginated<LecturerOption>>(offering ? "/admin/lecturers/" : null, { department: dept, status: "ACTIVE", page_size: 100 });
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => setSelected(offering?.lecturers ?? []), [offering]);
  const save = useAction<{ lecturers: number[] }>("POST", `/admin/offerings/${offering?.id}/allocate/`, { success: "Allocation saved.", onSuccess: onClose });

  return (
    <Dialog open={!!offering} onClose={onClose} title={`Allocate ${offering?.course_detail.code}`}
      description={`${offering?.course_detail.title} · only lecturers in ${offering?.course_detail.department_name} can be allocated.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate({ lecturers: selected })}>Save allocation</Button></>}>
      <ul className="space-y-2">
        {data?.results.map((l) => {
          const on = selected.includes(l.id);
          return (
            <li key={l.id}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${on ? "border-primary bg-primary-soft/50" : "border-line"}`}>
                <input type="checkbox" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== l.id) : [...selected, l.id])} className="size-4 accent-[var(--primary)]" />
                <span className="flex-1"><span className="font-medium">{l.profile.title} {l.full_name}</span><span className="block font-mono text-[12px] text-muted">{l.profile.staff_id}</span></span>
                <span className="text-[12px] text-muted">{l.course_count} course(s)</span>
              </label>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
