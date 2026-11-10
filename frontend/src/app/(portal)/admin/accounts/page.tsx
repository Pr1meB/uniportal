"use client";

import { Pencil, Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { StatusDialog } from "@/components/status-dialog";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, StatTile, StatusBadge, Tile, type Tone } from "@/components/ui";
import { fieldError } from "@/lib/api";
import { useAction, useApi, useList, useLookups } from "@/lib/hooks";
import type { AccountStatus, Role } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Account {
  id: number; email: string; first_name: string; last_name: string; full_name: string; phone: string; role: Role; role_display: string;
  department: number | null; department_name: string | null; status: AccountStatus; identifier: string | null; last_login: string | null;
}

const roleTone: Record<Role, Tone> = { SUPER_ADMIN: "accent", DEPT_ADMIN: "info", LECTURER: "primary", STUDENT: "neutral" };

export default function AccountsPage() {
  const { data: lookups } = useLookups();
  const [filters, setFilters] = useState({ role: "", status: "", department: "" });
  const list = useList<Account>("/admin/accounts/", filters);
  const { data: summary } = useApi<{ by_role: Record<Role, number>; by_status: Record<AccountStatus, number> }>("/admin/accounts/summary/");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [statusFor, setStatusFor] = useState<Account | null>(null);
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow="Super admin" title="All accounts"
        description="Every user in the university. Create administrators, change roles, and activate, suspend or deactivate accounts."
        actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New administrator</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile dot="primary" label="Students" value={summary?.by_role.STUDENT ?? "–"} />
        <StatTile dot="indigo" label="Lecturers" value={summary?.by_role.LECTURER ?? "–"} />
        <StatTile dot="plum" label="Administrators" value={(summary?.by_role.DEPT_ADMIN ?? 0) + (summary?.by_role.SUPER_ADMIN ?? 0)} />
        <StatTile tone={summary?.by_status.SUSPENDED ? "warn" : "default"} dot="terracotta" label="Suspended / inactive" value={(summary?.by_status.SUSPENDED ?? 0) + (summary?.by_status.DEACTIVATED ?? 0)} />
      </div>
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Name, email, matric or staff ID" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className="sm:w-44">
              <option value="">All roles</option><option value="SUPER_ADMIN">Super Admin</option><option value="DEPT_ADMIN">Department Admin</option>
              <option value="LECTURER">Lecturer</option><option value="STUDENT">Student</option>
            </Select>
            <Select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} className="sm:w-48">
              <option value="">All departments</option>{lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="sm:w-36">
              <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DEACTIVATED">Deactivated</option>
            </Select>
          </div>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading}
          columns={[
            { key: "name", header: "User", primary: true, cell: (a) => <span><span className="font-medium text-ink">{a.full_name}</span><span className="block text-[12px] text-muted">{a.email}</span></span> },
            { key: "role", header: "Role", cell: (a) => <Badge tone={roleTone[a.role]}>{a.role_display}</Badge> },
            { key: "id", header: "ID", cell: (a) => <span className="font-mono text-[12px]">{a.identifier ?? "—"}</span> },
            { key: "dept", header: "Department", cell: (a) => a.department_name ?? <span className="text-muted">University</span>, mobileHidden: true },
            { key: "login", header: "Last sign in", cell: (a) => <span className="text-muted">{formatDate(a.last_login)}</span>, mobileHidden: true },
            { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            { key: "actions", header: "", align: "right" as const, cell: (a) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setStatusFor(a)} aria-label="Change status"><ShieldAlert className="size-4" /></Button>
              </div>
            ) },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
      <AccountForm open={!!editing} account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <StatusDialog open={!!statusFor} onClose={() => setStatusFor(null)} basePath="/admin/accounts/"
        user={statusFor && { id: statusFor.id, full_name: statusFor.full_name, status: statusFor.status }} />
    </>
  );
}

function AccountForm({ open, account, onClose }: { open: boolean; account: Account | null; onClose: () => void }) {
  const { data: lookups } = useLookups();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "DEPT_ADMIN" as Role, department: "", password: "" });
  useEffect(() => {
    if (!open) return;
    setForm(account
      ? { first_name: account.first_name, last_name: account.last_name, email: account.email, phone: account.phone, role: account.role, department: String(account.department ?? ""), password: "" }
      : { first_name: "", last_name: "", email: "", phone: "", role: "DEPT_ADMIN", department: "", password: "" });
  }, [open, account]);
  const save = useAction<Record<string, unknown>>(account ? "PATCH" : "POST", account ? `/admin/accounts/${account.id}/` : "/admin/accounts/", {
    success: account ? "Account updated." : "Administrator created.", onSuccess: onClose,
  });
  const err = save.error;
  const academic = account && (account.role === "STUDENT" || account.role === "LECTURER");

  return (
    <Dialog open={open} onClose={onClose} title={account ? "Edit account" : "New administrator"}
      description={academic ? "Student and lecturer roles are tied to academic records and can’t be switched." : "Create a super admin or a department admin."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} onClick={() => save.mutate({ ...form, department: form.role === "SUPER_ADMIN" ? null : form.department || null, password: form.password || undefined })}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={fieldError(err, "first_name")}><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
        <Field label="Last name" error={fieldError(err, "last_name")}><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
        <Field label="Email" error={fieldError(err, "email")} className="sm:col-span-2"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role" error={fieldError(err, "role")}>
          <Select value={form.role} disabled={!!academic} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="SUPER_ADMIN">Super Admin</option><option value="DEPT_ADMIN">Department Admin</option>
            {academic && <><option value="LECTURER">Lecturer</option><option value="STUDENT">Student</option></>}
          </Select>
        </Field>
        <Field label="Department" error={fieldError(err, "department")}>
          <Select value={form.department} disabled={form.role === "SUPER_ADMIN"} onChange={(e) => setForm({ ...form, department: e.target.value })}>
            <option value="">{form.role === "SUPER_ADMIN" ? "University-wide" : "Select…"}</option>
            {lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label={account ? "Reset password (optional)" : "Temporary password"} hint={account ? "Leave blank to keep" : "Defaults to Admin@1234"} error={fieldError(err, "password")} className="sm:col-span-2">
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
