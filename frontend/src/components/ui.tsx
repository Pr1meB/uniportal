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
