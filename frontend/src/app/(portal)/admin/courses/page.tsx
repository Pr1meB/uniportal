"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, Textarea, Tile } from "@/components/ui";
import { fieldError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useList, useLookups } from "@/lib/hooks";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [filters, setFilters] = useState({ level: "", term: "", department: "", is_active: "" });
  const list = useList<Course>("/admin/courses/", filters);
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const isSuper = me?.role === "SUPER_ADMIN";
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow={isSuper ? "University" : me?.department?.name} title="Course catalogue"
        description="Course codes, titles, units, level and semester. Attach each course to the programs whose students may take it."
        actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New course</Button>} />
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Code or title" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {isSuper && (
              <Select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} className="sm:w-48">
                <option value="">All departments</option>{lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
            <Select value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })} className="sm:w-32">
              <option value="">All levels</option>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
            <Select value={filters.term} onChange={(e) => setFilters({ ...filters, term: e.target.value })} className="sm:w-40">
              <option value="">Both semesters</option>{lookups?.terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading}
          columns={[
            { key: "code", header: "Code", cell: (c) => <span className="font-mono font-semibold text-primary">{c.code}</span> },
            { key: "title", header: "Title", primary: true, cell: (c) => <span className="text-ink">{c.title}{!c.is_active && <Badge className="ml-2" tone="danger">Inactive</Badge>}</span> },
            { key: "units", header: "Units", align: "center", cell: (c) => c.units },
            { key: "level", header: "Level", cell: (c) => <Badge>{c.level}L</Badge> },
            { key: "term", header: "Semester", cell: (c) => c.term_display.replace(" Semester", "") },
            { key: "programs", header: "Programs", cell: (c) => c.program_names.join(", ") || "—", mobileHidden: true },
            ...(isSuper ? [{ key: "dept", header: "Department", cell: (c: Course) => c.department_name, mobileHidden: true }] : []),
            { key: "edit", header: "", align: "right" as const, cell: (c) => <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label="Edit"><Pencil className="size-4" /></Button> },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
      <CourseForm open={!!editing} course={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}

function CourseForm({ open, course, onClose }: { open: boolean; course: Course | null; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const blank = { code: "", title: "", units: "3", level: "100", term: "FIRST", description: "", is_elective: false, is_active: true, department: "", programs: [] as number[] };
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setForm(course
      ? { code: course.code, title: course.title, units: String(course.units), level: String(course.level), term: course.term, description: course.description,
          is_elective: course.is_elective, is_active: course.is_active, department: String(course.department), programs: course.programs }
      : { ...blank, department: String(me?.department?.id ?? "") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course, me]);
  const save = useAction<typeof form>(course ? "PATCH" : "POST", course ? `/admin/courses/${course.id}/` : "/admin/courses/", {
    success: course ? "Course updated." : "Course created.", onSuccess: onClose,
  });
  const err = save.error;
  const programs = lookups?.programs.filter((p) => !form.department || String(p.department) === form.department) ?? [];

  return (
    <Dialog open={open} onClose={onClose} wide title={course ? `Edit ${course.code}` : "New course"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save course</Button></>}>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Code" error={fieldError(err, "code")}><Input value={form.code} placeholder="CSC 307" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Title" error={fieldError(err, "title")} className="sm:col-span-3"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Units" error={fieldError(err, "units")}><Select value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })}>{[1, 2, 3, 4, 5, 6].map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Level"><Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</Select></Field>
        <Field label="Semester" className="sm:col-span-2"><Select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>{lookups?.terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        {me?.role === "SUPER_ADMIN" && (
          <Field label="Department" error={fieldError(err, "department")} className="sm:col-span-2">
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, programs: [] })}>
              <option value="">Select…</option>{lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="sm:col-span-4">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Available to programs</span>
          <div className="flex flex-wrap gap-2">
            {programs.map((p) => {
              const on = form.programs.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setForm({ ...form, programs: on ? form.programs.filter((x) => x !== p.id) : [...form.programs, p.id] })}
                  className={`rounded-xl border px-3 py-1.5 text-[13px] ${on ? "border-primary bg-primary-soft text-primary" : "border-line-strong"}`}>{p.name}</button>
              );
            })}
          </div>
          {fieldError(err, "programs") && <span className="mt-1 block text-[12px] text-danger">{fieldError(err, "programs")}</span>}
        </div>
        <Field label="Description" className="sm:col-span-4"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={form.is_elective} onChange={(e) => setForm({ ...form, is_elective: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Elective</label>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Active</label>
      </div>
    </Dialog>
  );
}
