"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-reload";

/** Shown when a page fails to render. Retries once on its own for network drops. */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const network = isChunkLoadError(error);

  useEffect(() => {
    if (network) reloadOnce();
    else console.error(error);
  }, [error, network]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-tile">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {network ? "Connection interrupted" : "Something went wrong"}
        </p>
        <h1 className="mt-3 font-display text-2xl text-ink">
          {network ? "The page didn't finish loading" : "This page hit an error"}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {network
            ? "Your connection dropped while the page was downloading. Reloading usually fixes it."
            : "Try again. If it keeps happening, go back to your dashboard."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => (network ? window.location.reload() : reset())}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            {network ? "Reload page" : "Try again"}
          </button>
          {/* full page load on purpose: client navigation may be what failed */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink">
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
