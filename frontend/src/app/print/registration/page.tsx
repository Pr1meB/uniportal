"use client";

import { PrintHeader } from "@/components/print-header";
import { Skeleton } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { Registration, Semester } from "@/lib/types";

type Group = { semester: Semester; courses: Registration[]; units: number };

export default function RegistrationSlip() {
  const { data: me } = useMe();
  const { data } = useApi<Group[]>("/student/registrations/");
  if (!me || !data) return <Skeleton className="h-96" />;
  const current = data.find((g) => g.semester.is_current) ?? data[0];

  return (
    <>
      <PrintHeader title="Course Registration Slip" me={me} />
      {!current ? (
        <p className="mt-10 text-center text-[#6f6a60]">No registration on record.</p>
      ) : (
        <>
          <div className="mt-6 text-[13px]"><span className="text-[#6f6a60]">Semester:</span> <b>{current.semester.label}</b></div>
          <table className="mt-3 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-[#d3cab8] bg-[#f6f3ec] text-left text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2">#</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Course title</th>
                <th className="px-3 py-2 text-center">Units</th><th className="px-3 py-2">Lecturer(s)</th>
              </tr>
            </thead>
            <tbody>
              {current.courses.map((c, i) => (
                <tr key={c.id} className="border-b border-[#e4ddcf]">
                  <td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-mono font-semibold">{c.course_code}</td>
                  <td className="px-3 py-2">{c.course_title}</td><td className="px-3 py-2 text-center">{c.units}</td>
                  <td className="px-3 py-2 text-[12px]">{c.lecturers.join(", ") || "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td colSpan={3} className="px-3 py-2 text-right">Total units</td><td className="px-3 py-2 text-center">{current.units}</td><td /></tr>
            </tbody>
          </table>
          <div className="mt-16 grid grid-cols-2 gap-10 text-[12px]">
            <div className="border-t border-[#1d1c19] pt-2">Student’s signature & date</div>
            <div className="border-t border-[#1d1c19] pt-2">Level adviser / HOD</div>
          </div>
        </>
      )}
    </>
  );
}
