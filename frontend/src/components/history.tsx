import { CheckCircle2, FilePen, RotateCcw, Send, Undo2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof Send; cls: string }> = {
  RESULT_SAVE: { icon: FilePen, cls: "bg-paper-2 text-ink-2" },
  RESULT_SUBMIT: { icon: Send, cls: "bg-warn-soft text-warn" },
  RESULT_APPROVE: { icon: CheckCircle2, cls: "bg-ok-soft text-ok" },
  RESULT_REJECT: { icon: Undo2, cls: "bg-danger-soft text-danger" },
  RESULT_REOPEN: { icon: RotateCcw, cls: "bg-info-soft text-info" },
};

/** Audit trail for a result sheet, newest first. */
export function SheetHistory({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return <p className="px-5 py-6 text-[13px] text-muted">No activity recorded yet.</p>;
  return (
    <ol className="relative space-y-4 px-5 py-4">
      {entries.map((e, i) => {
        const meta = ICONS[e.action] ?? ICONS.RESULT_SAVE;
        const comment = (e.changes?.comment || e.changes?.reason) as string | undefined;
        const rows = (e.changes?.rows as unknown[] | undefined)?.length;
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < entries.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-line" />}
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${meta.cls}`}><meta.icon className="size-4" /></span>
            <div className="min-w-0 pb-1">
              <p className="text-[14px] text-ink">{e.summary}</p>
              <p className="text-[12px] text-muted">
                {[e.actor__first_name, e.actor__last_name].filter(Boolean).join(" ") || "System"} · {formatDate(e.created_at, true)}
                {rows ? ` · ${rows} row(s) changed` : ""}
              </p>
              {comment && <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[13px] italic text-ink-2">“{comment}”</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
