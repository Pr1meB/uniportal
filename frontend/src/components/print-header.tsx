import type { Me } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function PrintHeader({ title, me }: { title: string; me: Me }) {
  const p = me.student_profile;
  return (
    <>
      <div className="flex items-start justify-between gap-6 border-b-2 border-[#1f4d3b] pb-4">
        <div>
          <div className="font-display text-3xl text-[#1f4d3b]">Uniportal University</div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#6f6a60]">Office of the Registrar</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl">{title}</div>
          <div className="text-[12px] text-[#6f6a60]">Generated {formatDate(new Date().toISOString(), true)}</div>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3">
        {[
          ["Name", me.full_name],
          ["Matric number", p?.matric_number],
          ["Level", p?.level_display],
          ["Program", p?.program_name],
          ["Department", me.department?.name],
          ["Faculty", me.department?.faculty],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-[10px] uppercase tracking-[0.12em] text-[#6f6a60]">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
    </>
  );
}
