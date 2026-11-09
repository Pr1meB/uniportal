"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { SheetStatus } from "@/lib/types";

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "ink";
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:brightness-110 shadow-[0_6px_16px_-8px_var(--primary)]",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-paper-2",
  danger: "bg-danger text-on-color hover:brightness-110",
  accent: "bg-terracotta text-on-color hover:brightness-110 shadow-[0_6px_16px_-8px_var(--terracotta)]",
  ink: "bg-ink text-paper hover:opacity-90",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md"; loading?: boolean; href?: string }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, href, ...props }, ref) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[opacity,background-color,filter,border-color] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-5 text-sm",
    buttonStyles[variant],
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ----------------------------------- Tile ---------------------------------- */

export function Tile({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-tile)] border border-line bg-surface shadow-tile animate-rise", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TileHeader({ title, subtitle, action, className, index }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; index?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
          {index && <span className="font-mono text-[11px] font-medium text-muted">{index}</span>}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export type StatTone =
  | "default" | "primary" | "terracotta" | "saffron" | "indigo" | "plum" | "ink"
  | "accent" | "warn" | "danger";

const statTones: Record<StatTone, { box: string; filled: boolean }> = {
  default: { box: "bg-surface", filled: false },
  // filled jewel tiles (Bohemian) with a dot overlay (Pointillism)
  primary: { box: "bg-primary text-on-color border-transparent", filled: true },
  terracotta: { box: "bg-terracotta text-on-color border-transparent", filled: true },
  saffron: { box: "bg-saffron text-[#1f1b16] border-transparent", filled: true },
  indigo: { box: "bg-indigo text-on-color border-transparent", filled: true },
  plum: { box: "bg-plum text-on-color border-transparent", filled: true },
  ink: { box: "bg-ink text-paper border-transparent", filled: true },
  // soft washes
  accent: { box: "bg-terracotta-soft border-transparent", filled: false },
  warn: { box: "bg-saffron-soft border-transparent", filled: false },
  danger: { box: "bg-danger-soft border-transparent", filled: false },
};

type Jewel = "primary" | "terracotta" | "saffron" | "indigo" | "plum";
const jewelDot: Record<Jewel, string> = {
  primary: "bg-primary", terracotta: "bg-terracotta", saffron: "bg-saffron", indigo: "bg-indigo", plum: "bg-plum",
};

/**
 * Colour rule: tiles are neutral; a small jewel `dot` beside the label identifies the metric.
 * Use a filled `tone` for at most ONE tile per screen — the thing that needs attention.
 */
export function StatTile({
  label, value, hint, icon, tone = "default", dot, className, children,
}: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: StatTone; dot?: Jewel; className?: string; children?: ReactNode;
}) {
  const t = statTones[tone];
  return (
    <Tile className={cn("flex min-h-[132px] flex-col justify-between gap-4 p-5", t.box, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("eyebrow flex items-center gap-2", t.filled && "!text-current opacity-75")}>
          {dot && !t.filled && <span className={cn("size-2 rounded-full", jewelDot[dot])} />}
          {label}
        </span>
        {icon && <span className={cn("text-muted", t.filled && "text-current opacity-75")}>{icon}</span>}
      </div>
      <div>
        <div className="font-display text-[42px] font-medium leading-none tabular">{value}</div>
        {hint && <div className={cn("mt-2 text-[13px] text-muted", t.filled && "text-current opacity-80")}>{hint}</div>}
        {children}
      </div>
    </Tile>
  );
}

/** Pointillist progress meter: a row of dots, filled up to the ratio. */
export function DotMeter({ value, max, dots = 24, color = "var(--primary)", className, label }: {
  value: number; max: number; dots?: number; color?: string; className?: string; label?: string;
}) {
  const filled = max > 0 ? Math.round((Math.min(value, max) / max) * dots) : 0;
  return (
    <div className={cn("flex flex-wrap gap-[3px]", className)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} className="size-[7px] rounded-full transition-colors"
          style={{ background: i < filled ? color : "color-mix(in srgb, currentColor 14%, transparent)" }} />
      ))}
    </div>
  );
}

/** Pointillist hero tile; `hue` tints the dot field per role. */
export function HeroTile({ className, children, hue = "primary" }: { className?: string; children: ReactNode; hue?: "primary" | "terracotta" | "indigo" | "plum" }) {
  const palettes = {
    primary: ["var(--primary)", "var(--saffron)", "var(--indigo)", "var(--terracotta)"],
    terracotta: ["var(--terracotta)", "var(--saffron)", "var(--plum)", "var(--primary)"],
    indigo: ["var(--indigo)", "var(--plum)", "var(--primary)", "var(--saffron)"],
    plum: ["var(--plum)", "var(--terracotta)", "var(--indigo)", "var(--saffron)"],
  }[hue];
  return (
    <Tile className={cn("pointillist pointillist-edge p-6 md:p-8", className)}
      style={{ ["--p1" as string]: palettes[0], ["--p2" as string]: palettes[1], ["--p3" as string]: palettes[2], ["--p4" as string]: palettes[3] }}>
      {children}
    </Tile>
  );
}

/* --------------------------------- Page head -------------------------------- */

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="eyebrow mb-3 flex items-center gap-2">
            <span className="flex gap-[3px]" aria-hidden>
              <span className="size-1.5 rounded-full bg-terracotta" /><span className="size-1.5 rounded-full bg-saffron" /><span className="size-1.5 rounded-full bg-primary" />
            </span>
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[34px] leading-[1.02] text-ink sm:text-[44px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------- Badges ---------------------------------- */

const badgeTones = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
  accent: "bg-terracotta-soft text-terracotta border-transparent",
  primary: "bg-primary-soft text-primary border-transparent",
  plum: "bg-plum-soft text-plum border-transparent",
  saffron: "bg-saffron-soft text-warn border-transparent",
} as const;
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const sheetTone: Record<SheetStatus, Tone> = { DRAFT: "neutral", SUBMITTED: "warn", APPROVED: "ok", REJECTED: "danger" };
const sheetLabel: Record<SheetStatus, string> = { DRAFT: "Draft", SUBMITTED: "Awaiting review", APPROVED: "Approved", REJECTED: "Returned" };

export function SheetBadge({ status }: { status: SheetStatus | null | undefined }) {
  if (!status) return <Badge tone="neutral">Not started</Badge>;
  return <Badge tone={sheetTone[status]} dot>{sheetLabel[status]}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "ACTIVE" ? "ok" : status === "SUSPENDED" ? "warn" : "danger";
  return <Badge tone={tone} dot>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function GradePill({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-muted">—</span>;
  const tones: Record<string, Tone> = { A: "ok", B: "info", C: "saffron", D: "accent", E: "plum", F: "danger" };
  return <Badge tone={tones[grade] ?? "neutral"} className="min-w-8 justify-center font-mono font-semibold">{grade}</Badge>;
}

/* ---------------------------------- Inputs ---------------------------------- */

const fieldBase =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[14px] text-ink placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 pr-8 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6a60' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5", className)} {...props} />;
});

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

/* ---------------------------------- Dialog ---------------------------------- */

export function Dialog({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl animate-rise sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-2xl leading-tight">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-paper-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------- Misc bits -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-paper-2", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-paper-2 text-muted">{icon}</div>}
      <p className="font-display text-xl">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Tile className="p-6">
      <p className="font-medium text-danger">Couldn’t load this page</p>
      <p className="mt-1 text-sm text-muted">{error instanceof Error ? error.message : "Unknown error"}</p>
      {retry && <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>Try again</Button>}
    </Tile>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.split(/\s+/).filter(Boolean);
  const text = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const hues = ["bg-primary-soft text-primary", "bg-terracotta-soft text-terracotta", "bg-indigo-soft text-indigo", "bg-plum-soft text-plum", "bg-saffron-soft text-warn"];
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold", hue, className)}>
      {text}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-paper-2 p-1 text-[13px]">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition", value === o.value ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words text-[14px] text-ink">{value || "—"}</dd>
    </div>
  );
}
