"use client";

import { useState } from "react";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import { useAction } from "@/lib/hooks";
import type { AccountStatus } from "@/lib/types";

/** Activate / suspend / deactivate an account. Takes effect on the user's next request. */
export function StatusDialog({ open, onClose, user, basePath }: {
  open: boolean; onClose: () => void; user: { id: number; full_name: string; status: AccountStatus } | null; basePath: string;
}) {
  const [status, setStatus] = useState<AccountStatus>("SUSPENDED");
  const [reason, setReason] = useState("");
  const mutate = useAction<{ status: AccountStatus; reason: string }>("POST", () => `${basePath}${user?.id}/status/`, {
    success: "Account status updated.", onSuccess: () => { onClose(); setReason(""); },
  });
  return (
    <Dialog open={open} onClose={onClose} title="Change account status"
      description={`${user?.full_name} is currently ${user?.status.toLowerCase()}. Suspended or deactivated users are signed out immediately.`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={status === "ACTIVE" ? "primary" : "danger"} loading={mutate.isPending} onClick={() => mutate.mutate({ status, reason })}>Apply</Button>
      </>}>
      <div className="space-y-4">
        <Field label="New status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
            <option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DEACTIVATED">Deactivated</option>
          </Select>
        </Field>
        <Field label="Reason (recorded in the audit trail)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
