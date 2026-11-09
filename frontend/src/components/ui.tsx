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
