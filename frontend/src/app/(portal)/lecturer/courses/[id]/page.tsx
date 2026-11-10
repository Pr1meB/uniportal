"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Lock, Printer, Save, Send } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SheetHistory } from "@/components/history";
import { Badge, Button, Dialog, EmptyState, ErrorState, GradePill, Segmented, SheetBadge, Skeleton, StatTile, Tile, TileHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi, useLookups } from "@/lib/hooks";
import type { SheetPayload } from "@/lib/types";
import { cn, downloadCsv, num } from "@/lib/utils";
import { DataTable } from "@/components/data-table";

interface ClassMember { registration: number; student_id: number; name: string; email: string; matric_number: string; level: number; program: string }
type Draft = Record<number, { ca: string; exam: string }>;

export default function ScoreEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const path = `/lecturer/offerings/${id}/results/`;
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useApi<SheetPayload>(path);
  const { data: lookups } = useLookups();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<"scores" | "class" | "history">("scores");
  const roster = useApi<ClassMember[]>(tab === "class" ? `/lecturer/offerings/${id}/students/` : null);

  const caMax = lookups?.grading.ca_max ?? 30;
  const examMax = lookups?.grading.exam_max ?? 70;
  const bands = useMemo(() => [...(lookups?.grading.bands ?? [])].sort((a, b) => Number(b.min_score) - Number(a.min_score)), [lookups]);

  useEffect(() => {
    if (!data) return;
    const d: Draft = {};
    data.rows.forEach((r) => (d[r.registration] = { ca: r.ca_score === null ? "" : String(Number(r.ca_score)), exam: r.exam_score === null ? "" : String(Number(r.exam_score)) }));
    setDraft(d);
  }, [data]);

  const editable = data ? ["DRAFT", "REJECTED"].includes(data.sheet.status) : false;

  const dirtyEntries = useMemo(() => {
    if (!data) return [];
    return data.rows
      .filter((r) => {
        const d = draft[r.registration];
        if (!d) return false;
        const orig = { ca: r.ca_score === null ? "" : String(Number(r.ca_score)), exam: r.exam_score === null ? "" : String(Number(r.exam_score)) };
        return d.ca !== orig.ca || d.exam !== orig.exam;
      })
      .map((r) => ({ registration: r.registration, ca_score: draft[r.registration].ca === "" ? null : draft[r.registration].ca, exam_score: draft[r.registration].exam === "" ? null : draft[r.registration].exam }));
  }, [data, draft]);

  const invalid = (v: string, max: number) => v !== "" && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > max);
  const hasInvalid = Object.values(draft).some((d) => invalid(d.ca, caMax) || invalid(d.exam, examMax));
  const complete = data ? data.rows.every((r) => draft[r.registration]?.ca !== "" && draft[r.registration]?.exam !== "") : false;

  function live(reg: number) {
    const d = draft[reg];
    if (!d || d.ca === "" || d.exam === "" || invalid(d.ca, caMax) || invalid(d.exam, examMax)) return { total: null, grade: "" };
    const total = Number(d.ca) + Number(d.exam);
    const band = bands.find((b) => total >= Number(b.min_score));
    return { total, grade: band?.grade ?? "" };
  }

  async function save(): Promise<boolean> {
    if (!dirtyEntries.length) return true;
    setSaving(true);
    try {
      const res = await api<SheetPayload>(path, { method: "PUT", body: { entries: dirtyEntries } });
      qc.setQueryData([path, undefined], res);
      toast.success(`Saved ${dirtyEntries.length} change(s) as draft.`);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!(await save())) return;
    setSaving(true);
    try {
      const res = await api<SheetPayload>(`/lecturer/offerings/${id}/submit/`, { method: "POST" });
      qc.setQueryData([path, undefined], res);
      qc.invalidateQueries({ queryKey: ["/lecturer/dashboard/"] });
      toast.success("Results submitted for departmental review.");
      setConfirm(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;

  const { sheet, summary } = data;
  const c = sheet.offering.course_detail;

  const focusNext = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-score]"));
    const i = inputs.indexOf(e.currentTarget);
    inputs[i + 2]?.focus();
  };

  return (
    <>
      <Link href="/lecturer/courses" className="mb-4 inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> My courses</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-primary">{c.code}</span>
            <SheetBadge status={sheet.status} />
            {sheet.revision > 1 && <Badge tone="info">Revision {sheet.revision}</Badge>}
          </div>
          <h1 className="mt-1 font-display text-[34px] leading-tight sm:text-[40px]">{c.title}</h1>
          <p className="text-[14px] text-muted">{sheet.offering.semester_label} · {c.level} Level · {c.units} units · CA /{caMax}, Exam /{examMax}</p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save} loading={saving && !confirm} disabled={!dirtyEntries.length || hasInvalid}>
              <Save className="size-4" /> Save draft {dirtyEntries.length ? `(${dirtyEntries.length})` : ""}
            </Button>
            <Button onClick={() => setConfirm(true)} disabled={!complete || hasInvalid || !data.rows.length}><Send className="size-4" /> Submit for review</Button>
          </div>
        )}
      </div>

      {sheet.status === "REJECTED" && (
        <Tile className="mb-4 flex gap-3 border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          <div><div className="font-medium text-danger">Returned by {sheet.reviewed_by_name}</div><p className="mt-0.5 text-[14px]">{sheet.review_comment}</p></div>
        </Tile>
      )}
      {sheet.status === "SUBMITTED" && (
        <Tile className="mb-4 flex items-center gap-3 bg-warn-soft p-4 text-[14px]"><Lock className="size-4 text-warn" /> Submitted — locked until the department reviews it.</Tile>
      )}
      {sheet.status === "APPROVED" && (
        <Tile className="mb-4 flex items-center gap-3 bg-ok-soft p-4 text-[14px]"><CheckCircle2 className="size-4 text-ok" /> Approved by {sheet.reviewed_by_name}. Students can now see these results.</Tile>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile dot="indigo" label="Students" value={summary.count} />
        <StatTile dot="plum" label="Average" value={num(summary.avg, 1)} hint={`High ${num(summary.high, 0)} · Low ${num(summary.low, 0)}`} />
        <StatTile dot="primary" label="Passed" value={summary.passed} hint={`${summary.failed} failed`} />
        <StatTile dot="saffron" label="Entered" value={`${summary.entered}/${summary.count}`} />
      </div>

      <div className="mb-3"><Segmented value={tab} onChange={setTab} options={[{ value: "scores", label: "Score sheet" }, { value: "class", label: `Class list (${data.rows.length})` }, { value: "history", label: `Audit trail (${data.history.length})` }]} /></div>

      {tab === "class" ? (
        <Tile className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <TileHeader title="Class list" subtitle={`${c.code} · ${sheet.offering.semester_label} · ${roster.data?.length ?? "…"} students`} />
            <div className="no-print flex gap-2 px-5 pt-5">
              <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button size="sm" variant="secondary" disabled={!roster.data?.length}
                onClick={() => downloadCsv((roster.data ?? []).map((m, i) => ({ sn: i + 1, matric_number: m.matric_number, name: m.name, program: m.program, level: m.level, email: m.email })), `${c.code.replace(/\s+/g, "")}-class-list.csv`)}>
                <Download className="size-4" /> CSV
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <DataTable rows={roster.data} loading={roster.isLoading} rowKey={(m) => String(m.registration)} dense
              empty={<EmptyState title="No students registered yet" description="Students appear here as soon as they register this course." />}
              columns={[
                { key: "sn", header: "#", cell: (m) => <span className="text-muted tabular">{(roster.data?.indexOf(m) ?? 0) + 1}</span>, mobileHidden: true },
                { key: "matric", header: "Matric no.", cell: (m) => <span className="font-mono text-[13px]">{m.matric_number}</span> },
                { key: "name", header: "Name", primary: true, cell: (m) => <span className="font-medium text-ink">{m.name}</span> },
                { key: "program", header: "Program", cell: (m) => m.program, mobileHidden: true },
                { key: "level", header: "Level", cell: (m) => <Badge>{m.level}L</Badge> },
                { key: "email", header: "Email", cell: (m) => <span className="text-muted">{m.email}</span>, mobileHidden: true },
              ]} />
          </div>
        </Tile>
      ) : tab === "history" ? (
        <Tile><TileHeader title="Audit trail" subtitle="Every save, submission and review on this sheet" /><SheetHistory entries={data.history} /></Tile>
      ) : (
        <Tile className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                  <th className="w-10 px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Student</th>
                  <th className="w-28 px-2 py-3 text-center font-semibold">CA /{caMax}</th>
                  <th className="w-28 px-2 py-3 text-center font-semibold">Exam /{examMax}</th>
                  <th className="w-20 px-2 py-3 text-center font-semibold">Total</th>
                  <th className="w-20 px-4 py-3 text-center font-semibold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => {
                  const d = draft[r.registration] ?? { ca: "", exam: "" };
                  const l = editable ? live(r.registration) : { total: r.total === null ? null : Number(r.total), grade: r.grade };
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 text-muted tabular">{i + 1}</td>
                      <td className="px-4 py-2"><div className="font-medium text-ink">{r.student_name}</div><div className="font-mono text-[12px] text-muted">{r.matric_number}</div></td>
                      {(["ca", "exam"] as const).map((k) => (
                        <td key={k} className="px-2 py-2 text-center">
                          {editable ? (
                            <input data-score inputMode="decimal" type="number" step="0.5" min={0} max={k === "ca" ? caMax : examMax}
                              value={d[k]} onKeyDown={focusNext}
                              onChange={(e) => setDraft({ ...draft, [r.registration]: { ...d, [k]: e.target.value } })}
                              aria-label={`${k === "ca" ? "CA" : "Exam"} score for ${r.student_name}`}
                              className={cn("h-9 w-20 rounded-lg border bg-surface text-center tabular outline-none focus:border-primary focus:ring-4 focus:ring-primary/10",
                                invalid(d[k], k === "ca" ? caMax : examMax) ? "border-danger bg-danger-soft" : "border-line-strong")} />
                          ) : (
                            <span className="tabular">{num(k === "ca" ? r.ca_score : r.exam_score, 0)}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 text-center font-semibold tabular">{l.total === null ? "—" : l.total}</td>
                      <td className="px-4 text-center"><GradePill grade={l.grade} /></td>
                    </tr>
                  );
                })}
                {!data.rows.length && <tr><td colSpan={6} className="py-12 text-center text-muted">No students have registered for this course yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {editable && <div className="border-t border-line px-5 py-3 text-[12px] text-muted">Tip: press Enter to jump to the next student. Totals and grades update as you type; the server re-validates on save.</div>}
        </Tile>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Submit results for review?"
        description="Once submitted, scores are locked until your department approves or returns them."
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button loading={saving} onClick={submit}><Send className="size-4" /> Submit</Button></>}>
        <ul className="space-y-1.5 text-[14px]">
          <li>• {data.rows.length} students, all scores entered</li>
          <li>• Class average {num(summary.avg, 1)}, {summary.passed} passed</li>
          {dirtyEntries.length > 0 && <li>• {dirtyEntries.length} unsaved change(s) will be saved first</li>}
        </ul>
      </Dialog>
    </>
  );
}
