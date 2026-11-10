"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, PageHeader, Tile } from "@/components/ui";
import { api, fieldError } from "@/lib/api";

export default function ChangePasswordPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      setError(null);
      toast.error("The new passwords don’t match.");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/change-password/", { method: "POST", body: form });
      toast.success("Password updated. Other sessions have been signed out.");
      setForm({ current_password: "", new_password: "", confirm: "" });
      setError(null);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError(err);
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account" title="Change password" description="Use at least 8 characters. Changing it signs you out everywhere else." />
      <Tile className="max-w-lg p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password" error={fieldError(error, "current_password")}>
            <Input type="password" autoComplete="current-password" required value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
          </Field>
          <Field label="New password" error={fieldError(error, "new_password")}>
            <Input type="password" autoComplete="new-password" required value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" autoComplete="new-password" required value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </Field>
          <Button type="submit" loading={loading}>Update password</Button>
        </form>
      </Tile>
    </>
  );
}
