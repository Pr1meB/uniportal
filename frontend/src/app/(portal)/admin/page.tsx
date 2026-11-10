"use client";

import { ArrowUpRight, BookOpen, Building2, ClipboardCheck, Lock, Unlock, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { ActivityArea, Bars, Pipeline } from "@/components/charts";
import { Badge, ErrorState, HeroTile, Skeleton, StatTile, Tile, TileHeader } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import type { AuditEntry, SheetStatus } from "@/lib/types";
import { greeting, timeAgo } from "@/lib/utils";

interface AdminDashboard {
  scope: "university" | "department";
  department: string | null;
  semester: string | null;
  registration_open: boolean;
  counts: Record<string, number>;
  results: Record<SheetStatus | "not_started", number>;
  registrations_by_level: { level: number; count: number }[];
  activity: { day: string; count: number }[];
  recent_activity: AuditEntry[];
  departments?: { id: number; name: string; code: string; students: number; lecturers: number; pending: number; approved: number }[];
}

export default function AdminDashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading, error, refetch } = useApi<AdminDashboard>("/admin/dashboard/");
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !data) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>;

  const c = data.counts;
  const r = data.results;
  const uni = data.scope === "university";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* hero */}
      <HeroTile hue={uni ? "plum" : "terracotta"} className="col-span-2 lg:col-span-3">
        <div className="eyebrow">{greeting()}, {me?.first_name}</div>
        <h1 className="mt-2 font-display text-[40px] leading-[0.98] sm:text-[56px]">
          {uni ? "The university at a glance." : <>{data.department}<span className="text-muted">.</span></>}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
          <Badge tone="primary">{data.semester ?? "No current semester"}</Badge>
          {data.registration_open ? <Badge tone="ok"><Unlock className="size-3" /> Registration open</Badge> : <Badge><Lock className="size-3" /> Registration closed</Badge>}
        </div>
      </HeroTile>

      <Link href="/admin/results?status=SUBMITTED" className="col-span-2 lg:col-span-1">
        <StatTile tone={r.SUBMITTED ? "terracotta" : "default"} dot="terracotta" label="Awaiting your review" value={r.SUBMITTED}
          icon={<ClipboardCheck className="size-4" />} hint={<span className="inline-flex items-center gap-1">Open approval queue <ArrowUpRight className="size-3.5" /></span>}
          className="h-full transition hover:-translate-y-0.5" />
      </Link>

      <StatTile dot="primary" label="Students" value={c.students} hint={`${c.students_registered} registered this semester`} icon={<Users className="size-4" />} />
      <StatTile dot="indigo" label="Lecturers" value={c.lecturers} icon={<UserCog className="size-4" />} hint={c.unallocated_offerings ? `${c.unallocated_offerings} course(s) unallocated` : "All courses allocated"} />
      <StatTile dot="saffron" label="Courses offered" value={c.offerings} icon={<BookOpen className="size-4" />} hint={`${c.courses} active in catalogue`} />
      {uni ? (
        <StatTile dot="plum" label="Faculties · Depts" value={`${c.faculties} · ${c.departments}`} icon={<Building2 className="size-4" />} />
      ) : (
        <StatTile dot="plum" label="Registrations" value={c.registrations} hint="Course-student pairs this semester" />
      )}

      {/* results pipeline */}
      <Tile className="col-span-2 p-5">
        <div className="flex items-center justify-between"><h3 className="flex items-baseline gap-2 text-[15px] font-semibold"><span className="font-mono text-[11px] font-medium text-muted">01</span>Result pipeline</h3><span className="text-[13px] text-muted">{c.offerings} course sheets</span></div>
        <div className="mt-5">
          <Pipeline parts={[
            { label: "Approved", value: r.APPROVED, color: "var(--primary)" },
            { label: "Awaiting review", value: r.SUBMITTED, color: "var(--saffron)" },
            { label: "Returned", value: r.REJECTED, color: "var(--terracotta)" },
            { label: "Draft", value: r.DRAFT, color: "var(--indigo)" },
            { label: "Not started", value: r.not_started, color: "var(--line-strong)" },
          ]} />
        </div>
      </Tile>

      <Tile className="col-span-2">
        <TileHeader index="02" title="Registrations by level" subtitle={data.semester ?? ""} />
        <div className="px-3 pb-3">
          <Bars data={data.registrations_by_level.map((x) => ({ level: `${x.level}L`, count: x.count }))} x="level" y="count" height={180} emphasiseMax />
        </div>
      </Tile>

      {uni && data.departments && (
        <Tile className="col-span-2 overflow-hidden lg:col-span-4">
          <TileHeader index="03" title="Departments" subtitle="Headcount and this semester’s result approvals" />
          <div className="mt-3 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {data.departments.map((d) => (
              <div key={d.id} className="bg-surface p-5">
                <div className="flex items-center justify-between"><span className="font-mono text-[12px] font-semibold text-primary">{d.code}</span>
                  {d.pending > 0 && <Badge tone="warn">{d.pending} pending</Badge>}</div>
                <div className="mt-1 font-medium">{d.name}</div>
                <div className="mt-3 flex gap-4 text-[13px] text-muted"><span><b className="text-ink">{d.students}</b> students</span><span><b className="text-ink">{d.lecturers}</b> lecturers</span><span><b className="text-ink">{d.approved}</b> approved</span></div>
              </div>
            ))}
          </div>
        </Tile>
      )}

      <Tile className="col-span-2">
        <TileHeader index="04" title="Activity" subtitle="Audited actions over the last 14 days" />
        <div className="px-3 pb-3"><ActivityArea data={data.activity} /></div>
      </Tile>

      <Tile className="col-span-2">
        <TileHeader index="05" title="Recent activity" action={<Link href="/admin/audit" className="text-[13px] font-medium text-primary">Full audit trail</Link>} />
        <ul className="divide-y divide-line px-5 pb-3 pt-2">
          {data.recent_activity.map((a) => (
            <li key={a.id} className="flex gap-3 py-2.5">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.action.includes("APPROVE") ? "bg-primary" : a.action.includes("REJECT") || a.action.includes("FAILED") ? "bg-terracotta" : a.action.includes("SUBMIT") ? "bg-saffron" : a.action.includes("LOGIN") || a.action.includes("LOGOUT") ? "bg-line-strong" : "bg-indigo"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">{a.summary}</p>
                <p className="text-[12px] text-muted">{a.actor_name} · {timeAgo(a.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}
