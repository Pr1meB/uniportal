"use client";

import { useState } from "react";
import { DataTable, Pager, SearchBox } from "@/components/data-table";
import { Badge, Dialog, ErrorState, KeyValue, PageHeader, Select, Tile, type Tone } from "@/components/ui";
import { useList } from "@/lib/hooks";
import type { AuditEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const ACTION_TONE: Record<string, Tone> = {
  RESULT_APPROVE: "ok", RESULT_REJECT: "danger", RESULT_SUBMIT: "warn", RESULT_REOPEN: "info", RESULT_SAVE: "neutral",
  LOGIN_FAILED: "danger", STATUS_CHANGE: "warn", DELETE: "danger", CREATE: "primary", COURSE_REGISTER: "primary",
};

const GROUPS: Record<string, string> = {
  "": "All actions",
  "RESULT_SAVE,RESULT_SUBMIT,RESULT_APPROVE,RESULT_REJECT,RESULT_REOPEN": "Results workflow",
  "COURSE_REGISTER,COURSE_DROP": "Course registration",
  "CREATE,UPDATE,DELETE,ALLOCATE,SEMESTER_CHANGE": "Record changes",
  "STATUS_CHANGE": "Account status",
  "LOGIN,LOGOUT,LOGIN_FAILED": "Sign-ins",
};

export default function AuditPage() {
  const [actions, setActions] = useState("");
  const list = useList<AuditEntry>("/admin/audit-logs/", { action__in: actions });
  const [open, setOpen] = useState<AuditEntry | null>(null);
  if (list.error) return <ErrorState error={list.error} retry={list.refetch} />;

  return (
    <>
      <PageHeader eyebrow="Accountability" title="Audit trail"
        description="An append-only record of every important action: who did it, when, from where, and what changed." />
      <Tile className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="Search summary or user" />
          <Select value={actions} onChange={(e) => setActions(e.target.value)} className="sm:w-56">
            {Object.entries(GROUPS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <DataTable rows={list.data?.results} loading={list.isLoading} dense onRowClick={setOpen}
          columns={[
            { key: "when", header: "When", cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.created_at, true)}</span> },
            { key: "action", header: "Action", cell: (a) => <Badge tone={ACTION_TONE[a.action] ?? "neutral"}>{a.action_display}</Badge> },
            { key: "summary", header: "Summary", primary: true, cell: (a) => <span className="text-ink">{a.summary}</span> },
            { key: "actor", header: "By", cell: (a) => <span>{a.actor_name}<span className="block text-[11px] text-muted">{a.actor_role.replace("_", " ").toLowerCase()}</span></span> },
            { key: "dept", header: "Department", cell: (a) => a.department_name ?? "—", mobileHidden: true },
          ]} />
        <Pager page={list.page} count={list.data?.count ?? 0} onPage={list.setPage} />
      </Tile>
      <Dialog open={!!open} onClose={() => setOpen(null)} wide title={open?.action_display ?? ""} description={open?.summary}>
        {open && (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KeyValue label="When" value={formatDate(open.created_at, true)} />
              <KeyValue label="By" value={`${open.actor_name}${open.actor_email ? ` (${open.actor_email})` : ""}`} />
              <KeyValue label="Role" value={open.actor_role} />
              <KeyValue label="Record" value={`${open.entity_type} #${open.entity_id}`} />
              <KeyValue label="Department" value={open.department_name} />
              <KeyValue label="IP address" value={open.ip_address} />
            </dl>
            <div className="eyebrow mt-6">Details</div>
            <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink-2">{JSON.stringify(open.changes, null, 2)}</pre>
          </>
        )}
      </Dialog>
    </>
  );
}
