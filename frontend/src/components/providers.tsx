"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-reload";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  // Page JavaScript that fails to download during navigation never reaches an
  // error boundary, so catch it here and reload once.
  useEffect(() => {
    const onError = (e: ErrorEvent) => isChunkLoadError(e.error ?? e) && reloadOnce();
    const onRejection = (e: PromiseRejectionEvent) => isChunkLoadError(e.reason) && reloadOnce();
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!bg-surface !text-ink !border-line !rounded-xl !shadow-tile !font-sans",
            description: "!text-muted",
          },
        }}
      />
    </QueryClientProvider>
  );
}
