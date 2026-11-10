"use client";

import { Check, Lock, Printer, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Dialog, EmptyState, ErrorState, PageHeader, Skeleton, Tile, TileHeader } from "@/components/ui";
import { useAction, useApi } from "@/lib/hooks";
import type { Offering, Registration, Semester } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CoursesPayload {
  semester: Semester;
  max_units: number;
  registered_units: number;
  registered: Registration[];
  available: Offering[];
}

export default function CourseRegistrationPage() {
  const { data, isLoading, error, refetch } = useApi<CoursesPayload>("/student/courses/");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [dropping, setDropping] = useState<Registration | null>(null);

  const register = useAction<{ offerings: number[] }>("POST", "/student/courses/", {
    success: (res) => `Registered ${(res as Registration[]).length} course(s).`,
    onSuccess: () => { setSelected([]); setConfirm(false); },
  });
  const drop = useAction<number>("DELETE", (id) => `/student/courses/${id}/`, {
    success: "Course dropped.", onSuccess: () => setDropping(null),
  });

  const open = data?.semester.registration_open;
  const unregistered = useMemo(() => data?.available.filter((o) => !o.is_registered) ?? [], [data]);
  const selectedUnits = unregistered.filter((o) => selected.includes(o.id)).reduce((s, o) => s + o.course_detail.units, 0);
  const projected = (data?.registered_units ?? 0) + selectedUnits;
  const over = data ? projected > data.max_units : false;

  if (error) return <ErrorState error={error} retry={refetch} />;

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHeader
        eyebrow={data?.semester.label ?? "Course registration"}
        title="Course registration"
        description="Only courses for your program, level and this semester are listed. Duplicate registration is blocked."
        actions={data?.registered.length ? <Button variant="secondary" href="/print/registration"><Printer className="size-4" /> Print slip</Button> : null}
      />

      {!isLoading && !open && (
        <Tile className="mb-4 flex items-center gap-3 bg-warn-soft p-4 text-[14px]">
          <Lock className="size-4 text-warn" /> Registration is closed for this semester. Contact your department if you need changes.
        </Tile>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Tile>
          <TileHeader title="Available courses" subtitle={`${unregistered.length} course(s) you can still add`} />
          <div className="p-3">
            {isLoading ? (
              <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : !data?.available.length ? (
              <EmptyState title="No courses available" description="Nothing has been offered for your level this semester yet." />
            ) : (
              <ul className="space-y-2">
                {data.available.map((o) => {
                  const done = o.is_registered;
                  const on = selected.includes(o.id);
                  const full = o.capacity !== null && o.registered_count >= o.capacity;
                  return (
                    <li key={o.id}>
                      <button disabled={done || !open || full} onClick={() => toggle(o.id)}
                        className={cn("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
                          done ? "border-ok/30 bg-ok-soft/50" : on ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong",
                          (!open || full) && !done && "opacity-60")}>
                        <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg border",
                          done ? "border-ok bg-ok text-white" : on ? "border-primary bg-primary text-primary-ink" : "border-line-strong")}>
                          {(done || on) && <Check className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] font-semibold text-primary">{o.course_detail.code}</span>
                            {done && <Badge tone="ok">Registered</Badge>}
                            {full && !done && <Badge tone="danger">Full</Badge>}
                            {o.course_detail.is_elective && <Badge tone="accent">Elective</Badge>}
                          </span>
                          <span className="mt-0.5 block font-medium text-ink">{o.course_detail.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                            <UserRound className="size-3.5" />
                            {o.lecturer_details.map((l) => l.full_name).join(", ") || "Lecturer to be assigned"}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-display text-3xl leading-none">{o.course_detail.units}</span>
                          <span className="text-[11px] uppercase tracking-wider text-muted">units</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Tile>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Tile className="p-5">
            <div className="eyebrow">Unit load</div>
            <div className="mt-3 flex items-end justify-between">
              <span className={cn("font-display text-5xl leading-none tabular", over && "text-danger")}>{projected}</span>
              <span className="text-[13px] text-muted">of {data?.max_units ?? "–"} max</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
              <div className={cn("h-full rounded-full transition-all", over ? "bg-danger" : "bg-primary")}
                style={{ width: `${Math.min(100, (projected / (data?.max_units || 1)) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-muted">{data?.registered_units ?? 0} registered + {selectedUnits} selected</p>
            <Button className="mt-4 w-full" disabled={!selected.length || over || !open} onClick={() => setConfirm(true)}>
              Register {selected.length || ""} course{selected.length === 1 ? "" : "s"}
            </Button>
            {over && <p className="mt-2 text-[12px] text-danger">That’s above the semester limit.</p>}
          </Tile>

          <Tile>
            <TileHeader title="Registered" subtitle={`${data?.registered.length ?? 0} course(s)`} />
            <ul className="divide-y divide-line px-5 pb-2 pt-2">
              {data?.registered.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] font-semibold text-primary">{r.course_code}</div>
                    <div className="truncate text-[14px]">{r.course_title}</div>
                  </div>
                  <span className="text-[13px] text-muted">{r.units}u</span>
                  {open && !r.result_status && (
                    <button onClick={() => setDropping(r)} className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Drop ${r.course_code}`}>
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
              {!data?.registered.length && <li className="py-6 text-center text-[13px] text-muted">Nothing registered yet.</li>}
            </ul>
          </Tile>
        </div>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Confirm registration"
        description={`You’re adding ${selected.length} course(s), ${selectedUnits} units, for ${data?.semester.label}.`}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button loading={register.isPending} onClick={() => register.mutate({ offerings: selected })}>Confirm & register</Button>
        </>}>
        <ul className="space-y-2">
          {unregistered.filter((o) => selected.includes(o.id)).map((o) => (
            <li key={o.id} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-[14px]">
              <span><span className="font-mono font-semibold text-primary">{o.course_detail.code}</span> {o.course_detail.title}</span>
              <span className="text-muted">{o.course_detail.units}u</span>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={!!dropping} onClose={() => setDropping(null)} title={`Drop ${dropping?.course_code}?`}
        description="You can add it back while registration is open."
        footer={<>
          <Button variant="secondary" onClick={() => setDropping(null)}>Keep course</Button>
          <Button variant="danger" loading={drop.isPending} onClick={() => dropping && drop.mutate(dropping.id)}>Drop course</Button>
        </>}>
        <p className="text-[14px] text-ink-2">{dropping?.course_title}</p>
      </Dialog>
    </>
  );
}
