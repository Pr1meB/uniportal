"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Me, Role } from "@/lib/types";

export const HOME_FOR_ROLE: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  DEPT_ADMIN: "/admin",
  LECTURER: "/lecturer",
  STUDENT: "/student",
};

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me/"), staleTime: 5 * 60_000, retry: false });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api("/auth/logout/", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}

export function areaForPath(path: string): Role[] | null {
  if (path.startsWith("/student")) return ["STUDENT"];
  if (path.startsWith("/lecturer")) return ["LECTURER"];
  const superOnly = ["/admin/accounts", "/admin/roles", "/admin/structure", "/admin/sessions"];
  if (superOnly.some((p) => path.startsWith(p))) return ["SUPER_ADMIN"];
  if (path.startsWith("/admin")) return ["SUPER_ADMIN", "DEPT_ADMIN"];
  return null;
}
