"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type Paginated } from "@/lib/api";
import type { Lookups } from "@/lib/types";

type Query = Record<string, string | number | boolean | null | undefined>;

export function useApi<T>(path: string | null, query?: Query, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [path, query],
    queryFn: () => api<T>(path as string, { query }),
    enabled: path !== null && (opts.enabled ?? true),
  });
}

/** Paginated list with search + filters; resets to page 1 when they change. */
export function useList<T>(path: string, filters: Query = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState("");
  const key = JSON.stringify(filters);
  useEffect(() => setPage(1), [key]);
  const q = useApi<Paginated<T>>(path, { ...filters, page, search });
  const setSearch = useCallback((s: string) => {
    setSearchRaw(s);
    setPage(1);
  }, []);
  return { ...q, page, setPage, search, setSearch };
}

export function useLookups() {
  return useQuery({ queryKey: ["lookups"], queryFn: () => api<Lookups>("/lookups/"), staleTime: 5 * 60_000 });
}

/** POST/PATCH/PUT/DELETE with toast feedback and cache invalidation. */
export function useAction<TBody = unknown, TRes = unknown>(
  method: string,
  path: string | ((body: TBody) => string),
  opts: { success?: string | ((res: TRes) => string); invalidate?: QueryKey[]; onSuccess?: (res: TRes) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      api<TRes>(typeof path === "function" ? path(body) : path, {
        method,
        body: method === "DELETE" ? undefined : body,
      }),
    onSuccess: (res) => {
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res) : opts.success);
      (opts.invalidate ?? []).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      if (!opts.invalidate) qc.invalidateQueries();
      opts.onSuccess?.(res);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
