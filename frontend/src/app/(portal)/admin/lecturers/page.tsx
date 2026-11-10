"use client";

import { Pencil, Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { StatusDialog } from "@/components/status-dialog";
import { Button, Dialog, ErrorState, Field, Input, PageHeader, Select, StatusBadge, Tile } from "@/components/ui";
import { fieldError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useList, useLookups } from "@/lib/hooks";
import type { AccountStatus, LecturerProfile } from "@/lib/types";

interface LecturerRow {
  id: number; email: string; first_name: string; last_name: string; full_name: string; phone: string;
  department: number; department_name: string; status: AccountStatus; profile: LecturerProfile; course_count: number;
}

const empty = { first_name: "", last_name: "", email: "", phone: "", department: "", password: "",
  profile: { staff_id: "", title: "Dr.", rank: "", specialization: "", office: "" } };

export default function LecturersPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [dept, setDept] = useState("");
  const list = useList<LecturerRow>("/admin/lecturers/", { department: dept });
  const [editing, setEditing] = useState<LecturerRow | "new" | null>(null);
  const [statusFor, setStatusFor] = useState<LecturerRow | null>(null);
  const isSuper = me?.role === "SUPER_ADMIN";
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow={isSuper ? "University" : me?.department?.name} title="Lecturers"
        description="Create lecturer profiles. Course allocation happens on the Offerings page."
        actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add lecturer</Button>} />
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Name, email or staff ID" />
          {isSuper && (
            <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-56">
              <option value="">All departments</option>
              {lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading}
          columns={[
            { key: "name", header: "Lecturer", primary: true, cell: (l) => <span><span className="font-medium text-ink">{l.profile.title} {l.full_name}</span><span className="block text-[12px] text-muted">{l.email}</span></span> },
            { key: "staff", header: "Staff ID", cell: (l) => <span className="font-mono text-[13px]">{l.profile.staff_id}</span> },
            { key: "rank", header: "Rank", cell: (l) => l.profile.rank || "—" },
            { key: "spec", header: "Specialization", cell: (l) => l.profile.specialization || "—", mobileHidden: true },
            ...(isSuper ? [{ key: "dept", header: "Department", cell: (l: LecturerRow) => l.department_name, mobileHidden: true }] : []),
            { key: "courses", header: "Courses", align: "center" as const, cell: (l) => l.course_count },
            { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
            { key: "actions", header: "", align: "right" as const, cell: (l) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setStatusFor(l)} aria-label="Change status"><ShieldAlert className="size-4" /></Button>
              </div>
            ) },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
      <LecturerForm open={!!editing} lecturer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <StatusDialog open={!!statusFor} onClose={() => setStatusFor(null)} basePath="/admin/lecturers/"
        user={statusFor && { id: statusFor.id, full_name: statusFor.full_name, status: statusFor.status }} />
    </>
  );
}

function LecturerForm({ open, lecturer, onClose }: { open: boolean; lecturer: LecturerRow | null; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setForm(lecturer
      ? { first_name: lecturer.first_name, last_name: lecturer.last_name, email: lecturer.email, phone: lecturer.phone,
          department: String(lecturer.department), password: "", profile: { ...lecturer.profile } }
      : { ...empty, department: String(me?.department?.id ?? "") });
  }, [open, lecturer, me]);
  const save = useAction<typeof form>(lecturer ? "PATCH" : "POST", lecturer ? `/admin/lecturers/${lecturer.id}/` : "/admin/lecturers/", {
    success: lecturer ? "Lecturer updated." : "Lecturer created.", onSuccess: onClose,
  });
  const err = save.error;
  const setP = (k: keyof typeof form.profile, v: string) => setForm({ ...form, profile: { ...form.profile, [k]: v } });

  return (
    <Dialog open={open} onClose={onClose} wide title={lecturer ? "Edit lecturer" : "Add a lecturer"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} onClick={() => save.mutate({ ...form, password: form.password || undefined } as typeof form)}>{lecturer ? "Save changes" : "Create lecturer"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title"><Select value={form.profile.title} onChange={(e) => setP("title", e.target.value)}>
          {["Prof.", "Dr.", "Engr. Dr.", "Engr.", "Mr.", "Mrs.", "Ms."].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Staff ID" error={fieldError(err, "profile", "staff_id")}><Input value={form.profile.staff_id} placeholder="SP/CSC/104" onChange={(e) => setP("staff_id", e.target.value.toUpperCase())} /></Field>
        <Field label="First name" error={fieldError(err, "first_name")}><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
        <Field label="Last name" error={fieldError(err, "last_name")}><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
        <Field label="Email" error={fieldError(err, "email")}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {me?.role === "SUPER_ADMIN" && (
          <Field label="Department" error={fieldError(err, "department")}>
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select…</option>{lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Rank"><Input value={form.profile.rank} placeholder="Senior Lecturer" onChange={(e) => setP("rank", e.target.value)} /></Field>
        <Field label="Specialization"><Input value={form.profile.specialization} onChange={(e) => setP("specialization", e.target.value)} /></Field>
        <Field label="Office"><Input value={form.profile.office} onChange={(e) => setP("office", e.target.value)} /></Field>
        <Field label={lecturer ? "Reset password (optional)" : "Temporary password"} hint={lecturer ? "Leave blank to keep" : "Defaults to Lecturer@123"} error={fieldError(err, "password")}>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
