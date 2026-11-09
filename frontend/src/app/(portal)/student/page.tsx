"use client";

import { ArrowUpRight, BookOpenCheck, CalendarDays, GraduationCap, Printer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { GpaTrend } from "@/components/charts";
import { Badge, Button, DotMeter, ErrorState, HeroTile, KeyValue, Skeleton, StatTile, Tile, TileHeader } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import { greeting, num } from "@/lib/utils";

interface Dashboard {
  semester: string | null;
  registration_open: boolean;
  registered_courses: number;
  registered_units: number;
  cgpa: number | null;
  degree_class: string;
  units_passed: number;
  gpa_trend: { label: string; gpa: number | null; cgpa: number | null }[];
  last_gpa: number | null;
}

export default function StudentDashboard() {
  const { data: me } = useMe();
  const { data, isLoading, error, refetch } = useApi<Dashboard>("/student/dashboard/");
  if (error) return <ErrorState error={error} retry={refetch} />;
  const p = me?.student_profile;

  return (
    <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-4">
      {/* hero */}
      <HeroTile hue="primary" className="md:col-span-3">
        <div className="eyebrow">{greeting()}</div>
        <h1 className="mt-2 font-display text-[44px] leading-[0.98] sm:text-[60px]">{me?.first_name ?? "…"}<span className="text-terracotta">.</span></h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">
          {data?.semester ? <>You’re in <span className="text-ink">{data.semester}</span>.</> : "No active semester."}{" "}
          {data?.registration_open && data.registered_courses === 0 && "Course registration is open — don’t miss it."}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:max-w-[70%]">
          <KeyValue label="Matric no." value={<span className="font-mono">{p?.matric_number}</span>} />
          <KeyValue label="Level" value={p?.level_display} />
          <KeyValue label="Program" value={p?.program_name} />
          <KeyValue label="Department" value={me?.department?.name} />
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button href="/student/courses"><BookOpenCheck className="size-4" /> Register courses</Button>
          <Button href="/student/results" variant="secondary"><GraduationCap className="size-4" /> View results</Button>
        </div>
      </HeroTile>

      {isLoading ? <Skeleton className="h-full min-h-40" /> : (
        <StatTile tone="primary" label="Cumulative GPA" value={num(data?.cgpa)} hint={data?.degree_class}
          icon={<TrendingUp className="size-4" />}>
          <DotMeter value={Number(data?.cgpa ?? 0)} max={5} dots={20} color="currentColor" className="mt-4" label="CGPA out of 5" />
        </StatTile>
      )}

      {/* registration status */}
      <Tile className="flex flex-col p-5 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow">This semester</span>
          {data && (data.registration_open ? <Badge tone="ok" dot>Registration open</Badge> : <Badge tone="neutral">Registration closed</Badge>)}
        </div>
        <div className="mt-4 flex items-end gap-6">
          <div>
            <div className="font-display text-5xl leading-none tabular">{data?.registered_courses ?? "–"}</div>
            <div className="mt-1 text-[13px] text-muted">courses registered</div>
          </div>
          <div>
            <div className="font-display text-5xl leading-none tabular">{data?.registered_units ?? "–"}</div>
            <div className="mt-1 text-[13px] text-muted">units</div>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between font-mono text-[11px] text-muted"><span>UNIT LOAD</span><span>{data?.registered_units ?? 0} / 24</span></div>
          <DotMeter value={data?.registered_units ?? 0} max={24} dots={24} color="var(--terracotta)" label="Units registered" />
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link href="/student/courses" className="inline-flex items-center gap-1 text-[14px] font-medium text-primary">
            Manage registration <ArrowUpRight className="size-4" />
          </Link>
          {!!data?.registered_courses && (
            <Link href="/print/registration" className="ml-auto inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink">
              <Printer className="size-4" /> Print slip
            </Link>
          )}
        </div>
      </Tile>

      <StatTile dot="indigo" label="Last semester GPA" value={num(data?.last_gpa)} hint="Approved results only" icon={<CalendarDays className="size-4" />} />
      <StatTile dot="saffron" label="Units passed" value={data?.units_passed ?? "–"} hint="Credit units earned to date" />

      {/* trend */}
      <Tile className="md:col-span-4">
        <TileHeader index="01" title="Academic progress" subtitle="Semester GPA against cumulative GPA (5-point scale)" />
        <div className="px-3 pb-4 pt-2">
          {data?.gpa_trend?.length ? (
            <GpaTrend data={data.gpa_trend.map((t) => ({
              ...t,
              short: `${t.label.slice(2, 4)}/${t.label.slice(7, 9)} ${t.label.includes("First") ? "1st" : "2nd"}`,
              gpa: t.gpa === null ? null : Number(t.gpa),
              cgpa: t.cgpa === null ? null : Number(t.cgpa),
            }))} />
          ) : (
            <p className="px-2 py-10 text-center text-[14px] text-muted">Your GPA trend will appear once your first results are approved.</p>
          )}
        </div>
      </Tile>
    </div>
  );
}
