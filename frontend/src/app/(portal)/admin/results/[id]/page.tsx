"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { Bars } from "@/components/charts";
import { SheetHistory } from "@/components/history";
import { Badge, Button, Dialog, ErrorState, Field, GradePill, SheetBadge, Skeleton, StatTile, Textarea, Tile, TileHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { SheetPayload } from "@/lib/types";
import { formatDate, num } from "@/lib/utils";

type Mode = "approve" | "reject" | "reopen" | null;

export default function ReviewSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const path = `/admin/result-sheets/${id}/`;
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useApi<SheetPayload>(path);
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function act() {
    if (!mode) return;
    setBusy(true);
    try {
      const res = await api<SheetPayload>(`/admin/result-sheets/${id}/${mode}/`, { method: "POST", body: { comment } });
      qc.setQueryData([path, undefined], res);
      qc.invalidateQueries({ queryKey: ["/admin/result-sheets/"] });
      qc.invalidateQueries({ queryKey: ["/admin/dashboard/"] });
      toast.success(mode === "approve" ? "Results approved and released to students." : mode === "reject" ? "Returned to the lecturer." : "Results reopened for correction.");
      setMode(null);
      setComment("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  const { sheet, rows, summary } = data;
  const c = sheet.offering.course_detail;
  const grades = ["A", "B", "C", "D", "E", "F"].map((g) => ({ grade: g, count: summary.distribution[g] ?? 0 }));

  const copy = {
    approve: { title: "Approve these results?", desc: "Students will immediately see their scores and grades for this course.", label: "Approve & release", required: false },
    reject: { title: "Return for correction", desc: "The lecturer will see your note and can edit and resubmit.", label: "Return to lecturer", required: true },
    reopen: { title: "Reopen approved results", desc: "Results will be hidden from students until re-approved. A reason is recorded in the audit trail.", label: "Reopen", required: true },
  } as const;

  return (
    <>
      <Link href="/admin/results" className="mb-4 inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Approval queue</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-primary">{c.code}</span>
            <SheetBadge status={sheet.status} />
            {sheet.revision > 1 && <Badge tone="info">Revision {sheet.revision}</Badge>}
          </div>
          <h1 className="mt-1 font-display text-[34px] leading-tight sm:text-[40px]">{c.title}</h1>
          <p className="text-[14px] text-muted">
            {sheet.offering.semester_label} · {c.department_name} · Submitted by {sheet.submitted_by_name ?? "—"} {sheet.submitted_at && `on ${formatDate(sheet.submitted_at, true)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {sheet.status === "SUBMITTED" && (<>
            <Button variant="secondary" onClick={() => setMode("reject")}><Undo2 className="size-4" /> Return</Button>
            <Button onClick={() => setMode("approve")}><CheckCircle2 className="size-4" /> Approve</Button>
          </>)}
          {sheet.status === "APPROVED" && <Button variant="secondary" onClick={() => setMode("reopen")}><RotateCcw className="size-4" /> Reopen</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile dot="indigo" label="Students" value={summary.count} />
        <StatTile dot="plum" label="Average" value={num(summary.avg, 1)} hint={`High ${num(summary.high, 0)} · Low ${num(summary.low, 0)}`} />
        <StatTile dot="primary" label="Pass rate" value={summary.count ? `${Math.round((summary.passed / summary.count) * 100)}%` : "—"} hint={`${summary.passed} passed · ${summary.failed} failed`} />
        <StatTile tone={summary.entered === summary.count ? "default" : "danger"} dot="saffron" label="Complete" value={`${summary.entered}/${summary.count}`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Tile className="overflow-hidden">
          <TileHeader title="Scores" subtitle="Read-only. Only the lecturer can edit, and only when returned." />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead className="bg-surface-2"><tr className="border-y border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-2.5 text-left font-semibold">Student</th><th className="px-3 text-center font-semibold">CA</th>
                <th className="px-3 text-center font-semibold">Exam</th><th className="px-3 text-center font-semibold">Total</th><th className="px-5 text-center font-semibold">Grade</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-2.5"><div className="font-medium">{r.student_name}</div><div className="font-mono text-[12px] text-muted">{r.matric_number}</div></td>
                    <td className="px-3 text-center tabular">{num(r.ca_score, 0)}</td>
                    <td className="px-3 text-center tabular">{num(r.exam_score, 0)}</td>
                    <td className="px-3 text-center font-semibold tabular">{num(r.total, 0)}</td>
                    <td className="px-5 text-center"><GradePill grade={r.grade} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tile>
        <div className="space-y-4">
          <Tile>
            <TileHeader title="Grade distribution" />
            <div className="px-3 pb-3"><Bars data={grades} x="grade" y="count" height={170} highlight={(d) => d.grade === "F"} /></div>
          </Tile>
          {sheet.review_comment && (
            <Tile className="p-5">
              <div className="eyebrow">Last review note</div>
              <p className="mt-2 text-[14px] italic">“{sheet.review_comment}”</p>
              <p className="mt-2 text-[12px] text-muted">{sheet.reviewed_by_name} · {formatDate(sheet.reviewed_at, true)}</p>
            </Tile>
          )}
          <Tile><TileHeader title="Audit trail" /><SheetHistory entries={data.history} /></Tile>
        </div>
      </div>

      <Dialog open={!!mode} onClose={() => setMode(null)} title={mode ? copy[mode].title : ""} description={mode ? copy[mode].desc : ""}
        footer={<>
          <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
          <Button variant={mode === "approve" ? "primary" : mode === "reject" ? "danger" : "accent"} loading={busy}
            disabled={!!mode && copy[mode].required && !comment.trim()} onClick={act}>{mode && copy[mode].label}</Button>
        </>}>
        <Field label={mode === "approve" ? "Comment (optional)" : mode === "reject" ? "What needs correcting?" : "Reason for reopening"}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={mode === "reject" ? "e.g. Exam scores for rows 3 and 7 don’t match the scripts." : ""} />
        </Field>
      </Dialog>
    </>
  );
}
