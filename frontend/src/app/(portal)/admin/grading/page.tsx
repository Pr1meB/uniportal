"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Dialog, ErrorState, Field, GradePill, Input, PageHeader, Skeleton, Tile, TileHeader } from "@/components/ui";
import { fieldError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useAction, useApi, useLookups } from "@/lib/hooks";

interface Band { id: number; grade: string; min_score: string; max_score: string; point: string; remark: string }

export default function GradingPage() {
  const { data: me } = useMe();
  const { data: lookups } = useLookups();
  const { data, isLoading, error, refetch } = useApi<Band[]>("/admin/grade-bands/");
  const [editing, setEditing] = useState<Band | null>(null);
  const canEdit = me?.role === "SUPER_ADMIN";
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <>
      <PageHeader eyebrow="Academic rules" title="Grading scale"
        description="The 5-point scale used to grade every result. Changes apply to scores saved afterwards; approved results keep the grade they were approved with." />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Tile className="overflow-hidden">
          {isLoading ? <Skeleton className="m-5 h-60" /> : (
            <table className="w-full text-[14px]">
              <thead className="bg-surface-2"><tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 text-left font-semibold">Grade</th><th className="px-3 text-left font-semibold">Score range</th>
                <th className="px-3 text-center font-semibold">Point</th><th className="px-3 text-left font-semibold">Remark</th><th />
              </tr></thead>
              <tbody>
                {data?.map((b) => (
                  <tr key={b.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3"><GradePill grade={b.grade} /></td>
                    <td className="px-3 tabular">{Number(b.min_score)} – {Number(b.max_score)}</td>
                    <td className="px-3 text-center font-display text-2xl">{Number(b.point)}</td>
                    <td className="px-3 text-muted">{b.remark}</td>
                    <td className="px-5 text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(b)} aria-label={`Edit ${b.grade}`}><Pencil className="size-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tile>
        <div className="space-y-4">
          <Tile><TileHeader title="Score composition" />
            <div className="grid grid-cols-2 gap-4 p-5">
              <div><div className="eyebrow">Continuous assessment</div><div className="font-display text-4xl">{lookups?.grading.ca_max}</div></div>
              <div><div className="eyebrow">Examination</div><div className="font-display text-4xl">{lookups?.grading.exam_max}</div></div>
            </div>
          </Tile>
          <Tile className="p-5 text-[14px] leading-relaxed text-ink-2">
            <div className="eyebrow mb-2">GPA formula</div>
            <p className="font-mono text-[13px]">GPA = Σ (units × point) ÷ Σ units</p>
            <p className="mt-2 text-muted">CGPA applies the same formula across every approved result. Only approved results count. Max {lookups?.grading.max_units} units per semester.</p>
          </Tile>
        </div>
      </div>
      <BandForm band={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BandForm({ band, onClose }: { band: Band | null; onClose: () => void }) {
  const [form, setForm] = useState({ min_score: "", max_score: "", point: "", remark: "" });
  useEffect(() => { if (band) setForm({ min_score: band.min_score, max_score: band.max_score, point: band.point, remark: band.remark }); }, [band]);
  const save = useAction<typeof form>("PATCH", `/admin/grade-bands/${band?.id}/`, { success: "Grade band updated.", invalidate: [["/admin/grade-bands/"], ["lookups"]], onSuccess: onClose });
  const err = save.error;
  return (
    <Dialog open={!!band} onClose={onClose} title={`Edit grade ${band?.grade}`} description="Bands may not overlap."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(form)}>Save</Button></>}>
      {err && !fieldError(err, "min_score") && <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{(err as Error).message}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Min score" error={fieldError(err, "min_score")}><Input type="number" value={form.min_score} onChange={(e) => setForm({ ...form, min_score: e.target.value })} /></Field>
        <Field label="Max score" error={fieldError(err, "max_score")}><Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></Field>
        <Field label="Point" error={fieldError(err, "point")}><Input type="number" step="0.5" value={form.point} onChange={(e) => setForm({ ...form, point: e.target.value })} /></Field>
        <Field label="Remark" className="sm:col-span-3"><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
