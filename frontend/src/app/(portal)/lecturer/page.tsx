"use client";

import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Badge, DotMeter, ErrorState, HeroTile, SheetBadge, Skeleton, StatTile, Tile, TileHeader } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { SheetStatus } from "@/lib/types";
import { greeting, num } from "@/lib/utils";

interface LecturerDashboard {
  semester: string | null;
  courses: {
    id: number; code: string; title: string; units: number; level: number; students: number;
    status: SheetStatus | null; review_comment: string; average: number | null; passed: number | null; entered: number;
  }[];
  totals: { courses: number; students: number; pending_entry: number; awaiting_review: number; approved: number; returned: number };
}

export default function LecturerDashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading, error, refetch } = useApi<LecturerDashboard>("/lecturer/dashboard/");
  if (error) return <ErrorState error={error} retry={refetch} />;
  const returned = data?.courses.filter((c) => c.status === "REJECTED") ?? [];
  const title = me?.lecturer_profile?.title;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <HeroTile hue="indigo" className="col-span-2 lg:col-span-4">
        <div className="eyebrow">{greeting()}</div>
        <h1 className="mt-2 font-display text-[44px] leading-[0.98] sm:text-[60px]">{title} {me?.last_name}<span className="text-indigo">.</span></h1>
        <p className="mt-2 text-[15px] text-muted">
          {data?.semester ?? "—"} · {me?.lecturer_profile?.rank}, {me?.department?.name}
        </p>
      </HeroTile>

      <StatTile dot="indigo" label="Courses" value={data?.totals.courses ?? "–"} icon={<BookOpen className="size-4" />} hint="Allocated this semester" />
      <StatTile dot="plum" label="Students" value={data?.totals.students ?? "–"} icon={<Users className="size-4" />} hint="Across your classes" />
      <StatTile tone={!returned.length && data?.totals.awaiting_review ? "saffron" : "default"} dot="saffron" label="Awaiting review" value={data?.totals.awaiting_review ?? "–"} icon={<Clock className="size-4" />} />
      <StatTile dot="primary" label="Approved" value={data?.totals.approved ?? "–"} icon={<CheckCircle2 className="size-4" />} />

      {returned.length > 0 && (
        <Tile className="col-span-2 border-danger/30 bg-danger-soft p-5 lg:col-span-4">
          <div className="flex items-center gap-2 font-medium text-danger"><AlertTriangle className="size-4" /> Returned for correction</div>
          <ul className="mt-3 space-y-2">
            {returned.map((c) => (
              <li key={c.id}>
                <Link href={`/lecturer/courses/${c.id}`} className="block rounded-xl bg-surface/70 p-3 hover:bg-surface">
                  <span className="font-mono text-[13px] font-semibold">{c.code}</span> — <span className="text-[14px]">{c.review_comment}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tile>
      )}

      <Tile className="col-span-2 lg:col-span-4">
        <TileHeader index="01" title="My courses" subtitle="Enter scores, save drafts and submit for departmental review" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44" />)}
          {data?.courses.map((c) => {
            const pct = c.students ? Math.round((c.entered / c.students) * 100) : 0;
            return (
              <Link key={c.id} href={`/lecturer/courses/${c.id}`}
                className="group flex flex-col rounded-2xl border border-line bg-surface-2 p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-tile">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold text-primary">{c.code}</span>
                  <SheetBadge status={c.status} />
                </div>
                <div className="mt-2 line-clamp-2 min-h-[40px] font-medium leading-snug">{c.title}</div>
                <div className="mt-3 flex gap-2 text-[12px] text-muted">
                  <Badge>{c.level}L</Badge><Badge>{c.units} units</Badge><Badge>{c.students} students</Badge>
                </div>
                <div className="mt-auto pt-4">
                  <div className="flex justify-between text-[12px] text-muted"><span>Scores entered</span><span>{c.entered}/{c.students}</span></div>
                  <DotMeter value={c.entered} max={c.students || 1} dots={18} color={pct === 100 ? "var(--primary)" : "var(--indigo)"} className="mt-1.5" label="Scores entered" />
                  <div className="mt-3 flex items-center justify-between text-[13px]">
                    <span className="text-muted">Avg {num(c.average, 1)}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">Open <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5" /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Tile>
    </div>
  );
}
