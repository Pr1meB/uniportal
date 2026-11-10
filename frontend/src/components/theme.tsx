"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "uemp-theme";

/** Runs in <head> before paint so the page never flashes the wrong theme. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var r=document.documentElement;r.classList.remove('light','dark');if(t==='light'||t==='dark'){r.classList.add(t)}}catch(e){}})();`;

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (choice !== "system") root.classList.add(choice);
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage unavailable (private mode) — theme still applies for this page */
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setChoice(saved);
    } catch {
      /* ignore */
    }
  }, []);
  return {
    choice,
    set: (c: ThemeChoice) => {
      apply(c);
      setChoice(c);
    },
  };
}

const OPTIONS: { value: ThemeChoice; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

/** Three-way segmented switch: light / dark / follow system. */
export function ThemeSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { choice, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("inline-flex items-center rounded-full border border-line bg-surface-2 p-0.5", className)}>
      {OPTIONS.map((o) => {
        const on = choice === o.value;
        return (
          <button key={o.value} role="radio" aria-checked={on} aria-label={o.label} title={o.label} onClick={() => set(o.value)}
            className={cn("grid place-items-center rounded-full transition", compact ? "size-7" : "size-8",
              on ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink")}>
            <o.icon className="size-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
