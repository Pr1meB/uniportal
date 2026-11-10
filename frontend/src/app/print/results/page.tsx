"use client";

import { PrintHeader } from "@/components/print-header";
import { Skeleton } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { Transcript } from "@/lib/types";
import { num } from "@/lib/utils";

export default function ResultStatement() {
  const { data: me } = useMe();
  const { data } = useApi<Transcript>("/student/results/");
  if (!me || !data) return <Skeleton className="h-96" />;

  return (
    <>
      <PrintHeader title="Statement of Result" me={me} />
      {data.semesters.map((s) => (
        <section key={s.semester_id} className="mt-6 break-inside-avoid">
          <div className="flex items-baseline justify-between border-b border-[#d3cab8] pb-1">
            <h3 className="font-semibold">{s.label}</h3>
            <span className="text-[12px]">GPA <b>{num(s.gpa)}</b> · CGPA <b>{num(s.cgpa)}</b></span>
          </div>
          <table className="mt-2 w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#6f6a60]">
                <th className="py-1">Code</th><th>Title</th><th className="text-center">Units</th><th className="text-center">Score</th>
                <th className="text-center">Grade</th><th className="text-center">Point</th>
              </tr>
            </thead>
            <tbody>
              {s.courses.map((c) => (
                <tr key={c.code} className="border-t border-[#efeadf]">
                  <td className="py-1 font-mono">{c.code}</td><td>{c.title}</td><td className="text-center">{c.units}</td>
                  <td className="text-center">{num(c.total, 0)}</td><td className="text-center font-semibold">{c.grade}</td>
                  <td className="text-center">{num(c.grade_point, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <div className="mt-8 grid grid-cols-3 gap-4 rounded-xl border border-[#d3cab8] p-4 text-center text-[13px]">
        <div><div className="text-[10px] uppercase tracking-wider text-[#6f6a60]">Units passed</div><div className="text-xl font-semibold">{data.units_passed}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider text-[#6f6a60]">CGPA</div><div className="text-xl font-semibold">{num(data.cgpa)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider text-[#6f6a60]">Class</div><div className="text-xl font-semibold">{data.degree_class}</div></div>
      </div>
      <p className="mt-6 text-[11px] text-[#6f6a60]">
        This statement lists results approved by the department as of the date above. It is not a transcript.
      </p>
    </>
  );
}
