"use client";

import { CalendarRange, Lock, Plus, Star, Unlock } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Tile } from "@/components/ui";
import { fieldError, type Paginated } from "@/lib/api";
import { useAction, useApi } from "@/lib/hooks";
import type { Semester } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Session { id: number; name: string; start_date: string; end_date: string; is_current: boolean; semesters: Semester[] }

export default function SessionsPage() {
  const { data, isLoading, error, refetch } = useApi<Paginated<Session>>("/admin/sessions/", { page_size: 50 });
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<Semester | null>(null);
  const makeCurrent = useAction<number>("POST", (id) => `/admin/semesters/${id}/make-current/`, { success: "Current semester updated.", onSuccess: () => setConfirm(null) });
  const toggle = useAction<number>("POST", (id) => `/admin/semesters/${id}/toggle-registration/`, { success: (r) => ((r as Semester).registration_open ? "Registration opened." : "Registration closed.") });
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <>
      <PageHeader eyebrow="Super admin" title="Sessions & semesters"
        description="Set the current semester and open or close course registration. Creating a session also creates its two semesters."
        actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> New session</Button>} />
      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          {data?.results.map((s) => (
            <Tile key={s.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
                <div className="flex items-center gap-3">
                  <CalendarRange className="size-5 text-primary" />
                  <div><div className="font-display text-2xl">{s.name}</div><div className="text-[13px] text-muted">{formatDate(s.start_date)} – {formatDate(s.end_date)}</div></div>
                </div>
                {s.is_current && <Badge tone="primary"><Star className="size-3" /> Current session</Badge>}
              </div>
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {[...s.semesters].sort((a, b) => a.term.localeCompare(b.term)).map((sem) => (
                  <div key={sem.id} className="flex flex-col gap-3 bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{sem.term_display}</span>
                      <div className="flex gap-1.5">
                        {sem.is_current && <Badge tone="primary" dot>Current</Badge>}
                        {sem.registration_open ? <Badge tone="ok">Registration open</Badge> : <Badge>Closed</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!sem.is_current && <Button size="sm" variant="secondary" onClick={() => setConfirm(sem)}><Star className="size-3.5" /> Make current</Button>}
                      {sem.is_current && (
                        <Button size="sm" variant={sem.registration_open ? "secondary" : "primary"} loading={toggle.isPending && toggle.variables === sem.id} onClick={() => toggle.mutate(sem.id)}>
                          {sem.registration_open ? <><Lock className="size-3.5" /> Close registration</> : <><Unlock className="size-3.5" /> Open registration</>}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Tile>
          ))}
        </div>
      )}
      <NewSession open={creating} onClose={() => setCreating(false)} />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={`Make ${confirm?.label} current?`}
        description="The previous semester’s registration will be closed. Students and lecturers will see this semester by default."
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={makeCurrent.isPending} onClick={() => confirm && makeCurrent.mutate(confirm.id)}>Make current</Button></>}>
        <p className="text-[14px] text-muted">This change is recorded in the audit trail.</p>
      </Dialog>
    </>
  );
}

function NewSession({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
  const save = useAction<typeof form>("POST", "/admin/sessions/", { success: "Session created with both semesters.", onSuccess: () => { onClose(); setForm({ name: "", start_date: "", end_date: "" }); } });
  return (
    <Dialog open={open} onClose={onClose} title="New academic session"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Create</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Session" error={fieldError(save.error, "name")} className="sm:col-span-2"><Input value={form.name} placeholder="2027/2028" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Starts" error={fieldError(save.error, "start_date")}><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
        <Field label="Ends" error={fieldError(save.error, "end_date")}><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
