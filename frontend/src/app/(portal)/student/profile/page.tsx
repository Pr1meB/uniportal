"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Button, Field, Input, KeyValue, PageHeader, Select, Tile, TileHeader } from "@/components/ui";
import { api, fieldError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Me } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function StudentProfilePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [form, setForm] = useState({ phone: "", address: "", next_of_kin: "", next_of_kin_phone: "", date_of_birth: "", gender: "" });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me?.student_profile) return;
    const p = me.student_profile;
    setForm({ phone: me.phone ?? "", address: p.address, next_of_kin: p.next_of_kin, next_of_kin_phone: p.next_of_kin_phone,
      date_of_birth: p.date_of_birth ?? "", gender: p.gender });
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api<Me>("/student/profile/", { method: "PATCH", body: { ...form, date_of_birth: form.date_of_birth || null } });
      qc.setQueryData(["me"], updated);
      setError(null);
      toast.success("Profile updated.");
    } catch (err) {
      setError(err);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const p = me?.student_profile;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader eyebrow="Student" title="My profile" description="Keep your contact details current. Academic details are managed by your department." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Tile className="p-6">
          <div className="flex items-center gap-4">
            <Avatar name={me?.full_name ?? ""} className="size-14 text-lg" />
            <div>
              <div className="font-display text-2xl leading-tight">{me?.full_name}</div>
              <div className="text-[13px] text-muted">{me?.email}</div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-muted"><Lock className="size-3.5" /> Managed by the registry</div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <KeyValue label="Matric no." value={<span className="font-mono">{p?.matric_number}</span>} />
            <KeyValue label="Level" value={p?.level_display} />
            <KeyValue label="Program" value={p?.program_name} />
            <KeyValue label="Department" value={me?.department?.name} />
            <KeyValue label="Faculty" value={me?.department?.faculty} />
            <KeyValue label="Entry session" value={p?.entry_session_name} />
            <KeyValue label="Last sign in" value={formatDate(me?.last_login, true)} />
          </dl>
        </Tile>
        <Tile>
          <TileHeader title="Personal & contact details" subtitle="You can edit these." />
          <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Phone" error={fieldError(error, "phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Date of birth" error={fieldError(error, "date_of_birth")}><Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} /></Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={set("gender")}><option value="">Prefer not to say</option><option>Male</option><option>Female</option></Select>
            </Field>
            <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={set("address")} /></Field>
            <Field label="Next of kin"><Input value={form.next_of_kin} onChange={set("next_of_kin")} /></Field>
            <Field label="Next of kin phone"><Input value={form.next_of_kin_phone} onChange={set("next_of_kin_phone")} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={saving}>Save changes</Button></div>
          </form>
        </Tile>
      </div>
    </>
  );
}
