"use client";

import { Building2, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tile } from "@/components/ui";
import { fieldError, type Paginated } from "@/lib/api";
import { useAction, useApi } from "@/lib/hooks";

interface Faculty { id: number; name: string; code: string; is_active: boolean; department_count: number; student_count: number }
interface Department { id: number; name: string; code: string; faculty: number; faculty_name: string; is_active: boolean; student_count: number; lecturer_count: number; course_count: number }

export default function StructurePage() {
  const faculties = useApi<Paginated<Faculty>>("/admin/faculties/", { page_size: 100 });
  const departments = useApi<Paginated<Department>>("/admin/departments/", { page_size: 200 });
  const [fac, setFac] = useState<Faculty | "new" | null>(null);
  const [dept, setDept] = useState<Department | "new" | null>(null);
  if (faculties.error) return <ErrorState error={faculties.error} retry={faculties.refetch} />;

  return (
    <>
      <PageHeader eyebrow="Super admin" title="Faculties & departments" description="The university’s academic structure. Departments scope every department admin’s access."
        actions={<><Button variant="secondary" onClick={() => setDept("new")}><Plus className="size-4" /> Department</Button><Button onClick={() => setFac("new")}><Plus className="size-4" /> Faculty</Button></>} />
      {faculties.isLoading ? <Skeleton className="h-72" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {faculties.data?.results.map((f) => {
            const depts = departments.data?.results.filter((d) => d.faculty === f.id) ?? [];
            return (
              <Tile key={f.id} className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-2 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" /></span>
                    <div><div className="font-display text-2xl leading-tight">{f.name}</div><div className="text-[13px] text-muted">{f.code} · {f.department_count} departments · {f.student_count} students</div></div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setFac(f)} aria-label="Edit faculty"><Pencil className="size-4" /></Button>
                </div>
                <ul className="divide-y divide-line">
                  {depts.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-12 font-mono text-[12px] font-semibold text-primary">{d.code}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span>
                        <span className="text-[12px] text-muted">{d.student_count} students · {d.lecturer_count} lecturers · {d.course_count} courses</span></span>
                      {!d.is_active && <Badge tone="danger">Inactive</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => setDept(d)} aria-label="Edit department"><Pencil className="size-4" /></Button>
                    </li>
                  ))}
                  {!depts.length && <li className="px-5 py-6 text-center text-[13px] text-muted">No departments yet.</li>}
                </ul>
              </Tile>
            );
          })}
        </div>
      )}
      <FacultyForm item={fac} onClose={() => setFac(null)} />
      <DepartmentForm item={dept} faculties={faculties.data?.results ?? []} onClose={() => setDept(null)} />
    </>
  );
}

function FacultyForm({ item, onClose }: { item: Faculty | "new" | null; onClose: () => void }) {
  const existing = item && item !== "new" ? item : null;
  const [form, setForm] = useState({ name: "", code: "", is_active: true });
  useEffect(() => setForm(existing ? { name: existing.name, code: existing.code, is_active: existing.is_active } : { name: "", code: "", is_active: true }), [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction<typeof form>(existing ? "PATCH" : "POST", existing ? `/admin/faculties/${existing.id}/` : "/admin/faculties/", { success: "Faculty saved.", onSuccess: onClose });
  return (
    <Dialog open={!!item} onClose={onClose} title={existing ? "Edit faculty" : "New faculty"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" error={fieldError(save.error, "name")} className="sm:col-span-2"><Input value={form.name} placeholder="Faculty of Arts" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Code" error={fieldError(save.error, "code")}><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Active</label>
      </div>
    </Dialog>
  );
}

function DepartmentForm({ item, faculties, onClose }: { item: Department | "new" | null; faculties: Faculty[]; onClose: () => void }) {
  const existing = item && item !== "new" ? item : null;
  const [form, setForm] = useState({ name: "", code: "", faculty: "", is_active: true });
  useEffect(() => setForm(existing ? { name: existing.name, code: existing.code, faculty: String(existing.faculty), is_active: existing.is_active } : { name: "", code: "", faculty: String(faculties[0]?.id ?? ""), is_active: true }), [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction<typeof form>(existing ? "PATCH" : "POST", existing ? `/admin/departments/${existing.id}/` : "/admin/departments/", { success: "Department saved.", onSuccess: onClose });
  return (
    <Dialog open={!!item} onClose={onClose} title={existing ? "Edit department" : "New department"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" error={fieldError(save.error, "name")} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Code" error={fieldError(save.error, "code")}><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Faculty" error={fieldError(save.error, "faculty")} className="sm:col-span-3">
          <Select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })}>{faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
        </Field>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Active</label>
      </div>
    </Dialog>
  );
}
