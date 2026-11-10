"use client";

import { Pencil, Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { StatusDialog } from "@/components/status-dialog";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, StatusBadge, Tile } from "@/components/ui";
import { fieldError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useList, useLookups } from "@/lib/hooks";
import type { AccountStatus, StudentProfile } from "@/lib/types";

interface StudentRow {
  id: number; email: string; first_name: string; last_name: string; full_name: string; phone: string;
  department: number; department_name: string; status: AccountStatus; last_login: string | null; profile: StudentProfile;
}

const empty = { first_name: "", last_name: "", email: "", phone: "", department: "", password: "",
  profile: { matric_number: "", program: "", level: "100", gender: "" } };

export default function StudentsPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [filters, setFilters] = useState({ student_profile__level: "", student_profile__program: "", status: "", department: "" });
  const list = useList<StudentRow>("/admin/students/", filters);
  const [editing, setEditing] = useState<StudentRow | "new" | null>(null);
  const [statusFor, setStatusFor] = useState<StudentRow | null>(null);
  const isSuper = me?.role === "SUPER_ADMIN";

  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow={isSuper ? "University" : me?.department?.name} title="Students"
        description="Register students, keep their academic placement correct, and manage account access."
        actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Register student</Button>} />

      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Name, email or matric no." />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {isSuper && (
              <Select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} className="sm:w-44">
                <option value="">All departments</option>
                {lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
            <Select value={filters.student_profile__program} onChange={(e) => setFilters({ ...filters, student_profile__program: e.target.value })} className="sm:w-48">
              <option value="">All programs</option>
              {lookups?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={filters.student_profile__level} onChange={(e) => setFilters({ ...filters, student_profile__level: e.target.value })} className="sm:w-32">
              <option value="">All levels</option>
              {lookups?.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="sm:w-36">
              <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DEACTIVATED">Deactivated</option>
            </Select>
          </div>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading}
          columns={[
            { key: "name", header: "Student", primary: true, cell: (s) => <span><span className="font-medium text-ink">{s.full_name}</span><span className="block text-[12px] text-muted">{s.email}</span></span> },
            { key: "matric", header: "Matric no.", cell: (s) => <span className="font-mono text-[13px]">{s.profile.matric_number}</span> },
            { key: "program", header: "Program", cell: (s) => s.profile.program_name, mobileHidden: true },
            { key: "level", header: "Level", cell: (s) => <Badge>{s.profile.level}L</Badge> },
            ...(isSuper ? [{ key: "dept", header: "Department", cell: (s: StudentRow) => s.department_name, mobileHidden: true }] : []),
            { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            { key: "actions", header: "", align: "right" as const, cell: (s) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setStatusFor(s)} aria-label="Change status"><ShieldAlert className="size-4" /></Button>
              </div>
            ) },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>

      <StudentForm open={!!editing} student={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <StatusDialog open={!!statusFor} onClose={() => setStatusFor(null)} basePath="/admin/students/"
        user={statusFor && { id: statusFor.id, full_name: statusFor.full_name, status: statusFor.status }} />
    </>
  );
}

function StudentForm({ open, student, onClose }: { open: boolean; student: StudentRow | null; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({ first_name: student.first_name, last_name: student.last_name, email: student.email, phone: student.phone,
        department: String(student.department), password: "",
        profile: { matric_number: student.profile.matric_number, program: String(student.profile.program), level: String(student.profile.level), gender: student.profile.gender } });
    } else {
      setForm({ ...empty, department: String(me?.department?.id ?? "") });
    }
  }, [open, student, me]);

  const save = useAction<typeof form>(student ? "PATCH" : "POST", student ? `/admin/students/${student.id}/` : "/admin/students/", {
    success: student ? "Student updated." : "Student registered. They’ll be asked to change the temporary password.", onSuccess: onClose,
  });

  const programs = lookups?.programs.filter((p) => !form.department || String(p.department) === form.department) ?? [];
  const program = programs.find((p) => String(p.id) === form.profile.program);
  const isSuper = me?.role === "SUPER_ADMIN";
  const err = save.error;
  const setP = (k: keyof typeof form.profile, v: string) => setForm({ ...form, profile: { ...form.profile, [k]: v } });

  return (
    <Dialog open={open} onClose={onClose} wide title={student ? "Edit student" : "Register a student"}
      description={student ? student.profile.matric_number : "A temporary password is set; the student must change it at first sign in."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} onClick={() => save.mutate({ ...form, password: form.password || undefined } as typeof form)}>{student ? "Save changes" : "Register student"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={fieldError(err, "first_name")}><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
        <Field label="Last name" error={fieldError(err, "last_name")}><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
        <Field label="Email" error={fieldError(err, "email")}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Matriculation number" error={fieldError(err, "profile", "matric_number")}>
          <Input value={form.profile.matric_number} placeholder="CSC/2026/013" onChange={(e) => setP("matric_number", e.target.value.toUpperCase())} />
        </Field>
        {isSuper && (
          <Field label="Department" error={fieldError(err, "department")}>
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, profile: { ...form.profile, program: "" } })}>
              <option value="">Select…</option>
              {lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Program" error={fieldError(err, "profile", "program")}>
          <Select value={form.profile.program} onChange={(e) => setP("program", e.target.value)}>
            <option value="">Select…</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Level" error={fieldError(err, "profile", "level")}>
          <Select value={form.profile.level} onChange={(e) => setP("level", e.target.value)}>
            {(program?.levels ?? [100, 200, 300, 400]).map((l) => <option key={l} value={l}>{l} Level</option>)}
          </Select>
        </Field>
        <Field label="Gender">
          <Select value={form.profile.gender} onChange={(e) => setP("gender", e.target.value)}><option value="">—</option><option>Male</option><option>Female</option></Select>
        </Field>
        <Field label={student ? "Reset password (optional)" : "Temporary password"} hint={student ? "Leave blank to keep the current password" : "Defaults to Student@123 if left blank"} error={fieldError(err, "password")}>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
