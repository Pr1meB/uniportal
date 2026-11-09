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

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();
  const logout = useLogout();
  const [drawer, setDrawer] = useState(false);

  // Client-side routing guard (the API enforces the same rules server-side).
  useEffect(() => {
    if (error) router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (me) {
      const area = areaForPath(path);
      if (area && !area.includes(me.role)) router.replace(HOME_FOR_ROLE[me.role]);
    }
  }, [me, error, path, router]);

  useEffect(() => setDrawer(false), [path]);

  if (isLoading || !me) {
    return (
      <div className="dot-grid grid min-h-dvh place-items-center bg-paper">
        <div className="flex flex-col items-center gap-4"><LogoMark className="animate-pulse" /><Skeleton className="h-3 w-32" /></div>
      </div>
    );
  }

  const items = NAV.filter((n) => n.roles.includes(me.role));
  const mobileItems = items.filter((n) => n.mobile).slice(0, 4);
  const scope = me.role === "SUPER_ADMIN" ? "University-wide" : me.department?.name;
  const hue = ROLE_HUE[me.role];

  const sidebarFooter = (
    <div className="space-y-1 border-t border-line pt-4">
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="eyebrow">Theme</span>
        <ThemeSwitch compact />
      </div>
      <Link href="/account/password" className="flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink-2 hover:bg-paper-2">
        <KeyRound className="size-[18px]" strokeWidth={1.8} /> Change password
      </Link>
      <button onClick={() => logout.mutate()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink-2 hover:bg-danger-soft hover:text-danger">
        <LogOut className="size-[18px]" strokeWidth={1.8} /> Sign out
      </button>
    </div>
  );

  return (
    <div className="dot-grid min-h-dvh bg-paper">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-line bg-surface/85 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-1"><Brand /></div>
        <div className={cn("mx-1 mt-6 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium", hue.bg, hue.text)}>
          <span className={cn("size-1.5 rounded-full", hue.dot)} />
          <span className="truncate">{me.role_display}{scope ? ` · ${scope}` : ""}</span>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto pr-1"><NavList items={items} path={path} /></div>
        {sidebarFooter}
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-surface px-4 py-5 shadow-2xl animate-rise">
            <div className="flex items-center justify-between px-1">
              <Brand />
              <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-muted hover:bg-paper-2" aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <div className={cn("mx-1 mt-5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium", hue.bg, hue.text)}>
              <span className={cn("size-1.5 rounded-full", hue.dot)} />{me.role_display}{scope ? ` · ${scope}` : ""}
            </div>
            <div className="mt-5 flex-1 overflow-y-auto"><NavList items={items} path={path} onNavigate={() => setDrawer(false)} /></div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <div className="lg:pl-[268px]">
        {/* glass top bar */}
        <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
            <button onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-paper-2 lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden"><LogoMark className="size-7 p-[5px]" /><span className="font-display text-lg font-semibold">Uniportal</span></div>
            <div className="hidden items-center gap-2 font-mono text-[12px] text-muted lg:flex">
              <span className="text-line-strong">/</span>
              {path.split("/").filter(Boolean).map((seg, i, arr) => (
                <span key={i} className={cn(i === arr.length - 1 && "text-ink")}>{/^\d+$/.test(seg) ? `#${seg}` : seg}{i < arr.length - 1 && <span className="ml-2 text-line-strong">/</span>}</span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ThemeSwitch compact className="hidden sm:inline-flex lg:hidden" />
              <div className="hidden text-right sm:block">
                <div className="text-[14px] font-medium leading-tight">{me.full_name}</div>
                <div className="font-mono text-[11px] text-muted">{me.student_profile?.matric_number ?? me.lecturer_profile?.staff_id ?? me.email}</div>
              </div>
              <Avatar name={me.full_name} />
            </div>
          </div>
        </header>

        {me.must_change_password && path !== "/account/password" && (
          <div className="border-b border-line bg-saffron-soft">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] sm:px-6 lg:px-10">
              <KeyRound className="size-4 text-warn" />
              <span>Your account uses a temporary password.</span>
              <Link href="/account/password" className="font-medium text-warn underline underline-offset-2">Set a new one</Link>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-line bg-surface/80 shadow-tile backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))` }}>
          {mobileItems.map((item) => {
            const active = isActive(path, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", active ? "text-ink" : "text-muted")}>
                  <item.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
                  {active && <span className="absolute top-1 size-1 rounded-full bg-terracotta" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium text-muted">
              <Menu className="size-5" strokeWidth={1.8} />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
