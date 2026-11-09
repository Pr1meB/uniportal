"use client";

import {
  BarChart3, BookOpen, BookOpenCheck, Building2, CalendarRange, ClipboardCheck, ClipboardList, GraduationCap,
  KeyRound, LayoutGrid, Library, LogOut, Menu, ScrollText, Settings2, ShieldCheck, UserCog, UserRound, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeSwitch } from "@/components/theme";
import { Avatar, Skeleton } from "@/components/ui";
import { areaForPath, HOME_FOR_ROLE, useLogout, useMe } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; short?: string; icon: typeof LayoutGrid; roles: Role[]; mobile?: boolean; group?: string };

const NAV: NavItem[] = [
  // student
  { href: "/student", label: "Overview", short: "Home", icon: LayoutGrid, roles: ["STUDENT"], mobile: true },
  { href: "/student/courses", label: "Course registration", short: "Register", icon: BookOpenCheck, roles: ["STUDENT"], mobile: true },
  { href: "/student/results", label: "Results & CGPA", short: "Results", icon: GraduationCap, roles: ["STUDENT"], mobile: true },
  { href: "/student/profile", label: "My profile", short: "Profile", icon: UserRound, roles: ["STUDENT"], mobile: true },
  // lecturer
  { href: "/lecturer", label: "Overview", short: "Home", icon: LayoutGrid, roles: ["LECTURER"], mobile: true },
  { href: "/lecturer/courses", label: "My courses", short: "Courses", icon: BookOpen, roles: ["LECTURER"], mobile: true },
  // admin (shared)
  { href: "/admin", label: "Dashboard", short: "Home", icon: LayoutGrid, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], mobile: true, group: "Overview" },
  { href: "/admin/results", label: "Result approvals", short: "Approvals", icon: ClipboardCheck, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], mobile: true, group: "Overview" },
  { href: "/admin/students", label: "Students", icon: Users, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], mobile: true, group: "People" },
  { href: "/admin/lecturers", label: "Lecturers", icon: UserCog, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "People" },
  { href: "/admin/accounts", label: "All accounts", icon: ShieldCheck, roles: ["SUPER_ADMIN"], group: "People" },
  { href: "/admin/roles", label: "Roles & permissions", icon: KeyRound, roles: ["SUPER_ADMIN"], group: "People" },
  { href: "/admin/courses", label: "Courses", icon: Library, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "Academics" },
  { href: "/admin/offerings", label: "Offerings & allocation", icon: ClipboardList, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "Academics" },
  { href: "/admin/registrations", label: "Registrations", icon: BookOpenCheck, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "Academics" },
  { href: "/admin/programs", label: "Programs & levels", icon: GraduationCap, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "Academics" },
  { href: "/admin/structure", label: "Faculties & departments", icon: Building2, roles: ["SUPER_ADMIN"], group: "University" },
  { href: "/admin/sessions", label: "Sessions & semesters", icon: CalendarRange, roles: ["SUPER_ADMIN"], group: "University" },
  { href: "/admin/grading", label: "Grading scale", icon: Settings2, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "University" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], group: "Insight" },
  { href: "/admin/audit", label: "Audit trail", short: "Audit", icon: ScrollText, roles: ["SUPER_ADMIN", "DEPT_ADMIN"], mobile: true, group: "Insight" },
];

/** Each role gets its own jewel colour, used for the role chip and hero tint. */
export const ROLE_HUE: Record<Role, { text: string; bg: string; dot: string }> = {
  STUDENT: { text: "text-primary", bg: "bg-primary-soft", dot: "bg-primary" },
  LECTURER: { text: "text-indigo", bg: "bg-indigo-soft", dot: "bg-indigo" },
  DEPT_ADMIN: { text: "text-terracotta", bg: "bg-terracotta-soft", dot: "bg-terracotta" },
  SUPER_ADMIN: { text: "text-plum", bg: "bg-plum-soft", dot: "bg-plum" },
};

function isActive(path: string, href: string) {
  const root = ["/student", "/lecturer", "/admin"].includes(href);
  return root ? path === href : path === href || path.startsWith(href + "/");
}

/** Logo: a 3×3 stipple of jewel dots forming a "U"-ish mark. */
export function LogoMark({ className }: { className?: string }) {
  const colors = [
    "var(--terracotta)", null, "var(--saffron)",
    "var(--plum)", null, "var(--indigo)",
    "var(--primary)", "var(--primary)", "var(--primary)",
  ];
  return (
    <span className={cn("grid size-9 grid-cols-3 gap-[3px] rounded-xl bg-ink p-[7px]", className)} aria-hidden>
      {colors.map((c, i) => (
        <span key={i} className="rounded-full" style={{ background: c ?? "transparent" }} />
      ))}
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className="block font-display text-[20px] font-semibold">Uniportal</span>
        <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Education mgmt.</span>
      </span>
    </Link>
  );
}

function NavList({ items, path, onNavigate }: { items: NavItem[]; path: string; onNavigate?: () => void }) {
  const groups = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group ?? ""] ??= []).push(item);
    return acc;
  }, {});
  return (
    <nav className="space-y-5">
      {Object.entries(groups).map(([group, list], gi) => (
        <div key={group}>
          {group && (
            <div className="eyebrow mb-1.5 flex items-center gap-2 px-3">
              <span className="text-line-strong">{String(gi + 1).padStart(2, "0")}</span>{group}
            </div>
          )}
          <ul className="space-y-0.5">
            {list.map((item) => {
              const active = isActive(path, item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate}
                    className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition",
                      active ? "bg-ink text-paper shadow-sm" : "text-ink-2 hover:bg-paper-2")}>
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto size-1.5 rounded-full bg-saffron" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
