"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, ClipboardCheck, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/shell";
import { ThemeSwitch } from "@/components/theme";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { areaForPath, HOME_FOR_ROLE } from "@/lib/auth";
import type { Me } from "@/lib/types";

const DEMO = [
  { role: "Super Admin", email: "superadmin@uemp.test", color: "var(--plum)" },
  { role: "Department Admin", email: "csc.admin@uemp.test", color: "var(--terracotta)" },
  { role: "Lecturer", email: "lecturer@uemp.test", color: "var(--indigo)" },
  { role: "Student", email: "student@uemp.test", color: "var(--primary)" },
];
const DEMO_PASSWORD = "Uemp@2026";
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await api<Me>("/auth/login/", { method: "POST", body: { email, password }, retry: true });
      qc.setQueryData(["me"], me);
      const next = params.get("next");
      const allowed = next && next.startsWith("/") && !next.startsWith("//") && (areaForPath(next)?.includes(me.role) ?? true);
      router.replace(allowed ? next! : HOME_FOR_ROLE[me.role]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 lg:hidden">
        <LogoMark className="size-11 p-[9px]" />
      </div>
      <div className="eyebrow">Secure sign in</div>
      <h1 className="mt-3 font-display text-[46px] leading-[0.98]">Welcome back<span className="text-terracotta">.</span></h1>
      <p className="mt-2 text-[15px] text-muted">Use your university email to reach your dashboard.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email address">
          <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@uemp.test" />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">{error}</div>}
        <Button type="submit" variant="ink" loading={loading} className="h-12 w-full">
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Evaluation accounts</span>
            <span className="font-mono text-[11px] text-muted">pw: {DEMO_PASSWORD}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); }}
                className="group rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-ink/40">
                <span className="flex items-center gap-1.5 text-[13px] font-medium"><span className="size-1.5 rounded-full" style={{ background: d.color }} />{d.role}</span>
                <span className="block truncate text-[11px] text-muted">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[1.15fr_1fr]">
      <section className="pointillist relative hidden overflow-hidden border-r border-line bg-surface p-12 lg:flex lg:flex-col"
        style={{ ["--p1" as string]: "var(--terracotta)", ["--p2" as string]: "var(--indigo)", ["--p3" as string]: "var(--saffron)", ["--p4" as string]: "var(--primary)" }}>
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-2xl font-semibold">Uniportal</span>
        </div>
        <div className="my-auto max-w-xl">
          <div className="eyebrow">University Education Management Portal</div>
          <h2 className="mt-5 font-display text-[68px] font-medium leading-[0.95] text-ink">
            Registration, results &amp; records<span className="text-terracotta">.</span>
            <span className="mt-3 block text-primary">One calm place.</span>
          </h2>
          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              { n: "01", icon: BookOpenCheck, t: "Course registration", d: "Validated against program, level and unit load", c: "text-primary" },
              { n: "02", icon: ClipboardCheck, t: "Result approval", d: "Lecturer → department review → students", c: "text-indigo" },
              { n: "03", icon: ShieldCheck, t: "Audited", d: "Every submission and approval is traceable", c: "text-terracotta" },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-line bg-surface/80 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <f.icon className={`size-5 ${f.c}`} strokeWidth={1.8} />
                  <span className="font-mono text-[11px] text-muted">{f.n}</span>
                </div>
                <div className="mt-3 text-[14px] font-medium">{f.t}</div>
                <div className="mt-1 text-[12px] leading-snug text-muted">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">© {new Date().getFullYear()} Uniportal · Academic Registry</div>
      </section>
      <section className="dot-grid relative flex items-center justify-center px-5 py-12 sm:px-10">
        <ThemeSwitch className="absolute right-5 top-5" />
        <Suspense><LoginForm /></Suspense>
      </section>
    </div>
  );
}
