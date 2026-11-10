"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, Tile } from "@/components/ui";
import { fieldError, type Paginated } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useApi, useLookups } from "@/lib/hooks";

interface Program { id: number; name: string; code: string; degree: string; duration_years: number; department: number; department_name: string; levels: number[]; is_active: boolean; student_count: number }

export default function ProgramsPage() {
  const { data: me } = useMe();
  const { data, isLoading, error, refetch } = useApi<Paginated<Program>>("/admin/programs/", { page_size: 100 });
  const [editing, setEditing] = useState<Program | "new" | null>(null);
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <>
      <PageHeader eyebrow={me?.role === "SUPER_ADMIN" ? "University" : me?.department?.name} title="Programs & levels"
        description="Degree programs and how many years they run. A program’s duration sets the academic levels its students can be placed in."
        actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New program</Button>} />
      <Tile className="overflow-hidden">
        <DataTable rows={data?.results} loading={isLoading}
          columns={[
            { key: "name", header: "Program", primary: true, cell: (p) => <span className="font-medium text-ink">{p.degree} {p.name}</span> },
            { key: "code", header: "Code", cell: (p) => <span className="font-mono text-[13px]">{p.code}</span> },
            { key: "dept", header: "Department", cell: (p) => p.department_name },
            { key: "levels", header: "Levels", cell: (p) => <div className="flex flex-wrap gap-1">{p.levels.map((l) => <Badge key={l}>{l}</Badge>)}</div> },
            { key: "students", header: "Students", align: "center", cell: (p) => p.student_count },
            { key: "status", header: "Status", cell: (p) => (p.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Inactive</Badge>) },
            { key: "edit", header: "", align: "right" as const, cell: (p) => <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit"><Pencil className="size-4" /></Button> },
          ]} />
      </Tile>
      <ProgramForm open={!!editing} program={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ProgramForm({ open, program, onClose }: { open: boolean; program: Program | null; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [form, setForm] = useState({ name: "", code: "", degree: "B.Sc.", duration_years: "4", department: "", is_active: true });
  useEffect(() => {
    if (!open) return;
    setForm(program
      ? { name: program.name, code: program.code, degree: program.degree, duration_years: String(program.duration_years), department: String(program.department), is_active: program.is_active }
      : { name: "", code: "", degree: "B.Sc.", duration_years: "4", department: String(me?.department?.id ?? ""), is_active: true });
  }, [open, program, me]);
  const save = useAction<typeof form>(program ? "PATCH" : "POST", program ? `/admin/programs/${program.id}/` : "/admin/programs/", {
    success: "Program saved.", invalidate: [["/admin/programs/"], ["lookups"]], onSuccess: onClose,
  });
  const err = save.error;
  return (
    <Dialog open={open} onClose={onClose} title={program ? "Edit program" : "New program"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldError(err, "name")} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Code" error={fieldError(err, "code")}><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Degree"><Select value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })}>{["B.Sc.", "B.Eng.", "B.Tech.", "B.A.", "B.Ed."].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Duration (years)" hint="Determines the levels available" error={fieldError(err, "duration_years")}>
          <Select value={form.duration_years} onChange={(e) => setForm({ ...form, duration_years: e.target.value })}>{[3, 4, 5, 6].map((y) => <option key={y}>{y}</option>)}</Select>
        </Field>
        {me?.role === "SUPER_ADMIN" && (
          <Field label="Department" error={fieldError(err, "department")}>
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select…</option>{lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Active</label>
      </div>
    </Dialog>
  );
}
