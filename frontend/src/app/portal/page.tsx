"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HOME_FOR_ROLE, useMe } from "@/lib/auth";

/** Sends a signed-in user to the dashboard for their role. */
export default function PortalRedirect() {
  const { data, error } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (data) router.replace(HOME_FOR_ROLE[data.role]);
    if (error) router.replace("/login");
  }, [data, error, router]);
  return <div className="min-h-dvh bg-paper" />;
}
