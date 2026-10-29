"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import type { OrgAccountInit, OrgAccountValues } from "@/lib/systmMngt/orgAccounts";
import FormShell, { Row } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/**
 * CI org_accounts initForm (formview_v): code, name, address (read-only), email, registered domain,
 * contact number and status (read-only). Editable for the superadmin only; other admins see their
 * organisation read-only and Cancel goes to the dashboard, as in CI.
 */
const API = "/api/systmMngt/org_accounts";

const FIELDS: Array<{ key: keyof OrgAccountValues; label: string }> = [
  { key: "oaCd", label: "Oa Code" },
  { key: "oaName", label: "Oa Name" },
  { key: "oaEmail", label: "Oa Email" },
  { key: "oaWebDomain", label: "Registered Domain" },
  { key: "oaContactNo", label: "Oa Contact No." },
];

function Editor({ init, id }: { init: OrgAccountInit; id: string }) {
  const router = useRouter();
  const [v, setV] = useState(init.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const back = init.canEdit ? "/systmMngt/org_accounts" : "/dashboard";

  const save = async () => {
    if (!init.canEdit) return router.push(back);
    setBusy(true);
    const r = await saveForm(`${API}/${encodeURIComponent(id)}`, "PUT", v);
    setBusy(false);
    if (!r.ok) return setErrors(r.errors);
    router.push(back);
  };

  return (
    <FormShell title={init.title} breadcrumb={["System Manager", "Organisation"]} mode="edit" busy={busy || !init.canEdit} onSave={save} onCancel={() => router.push(back)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.slice(0, 2).map((f) => (
          <Row key={f.key} label={f.label} htmlFor={f.key} required error={errors[f.key]}>
            <Input id={f.key} value={v[f.key]} readOnly={!init.canEdit} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} />
          </Row>
        ))}
        <Row label="Account Address" htmlFor="address">
          <Input id="address" value={init.address} readOnly className="bg-[#f6f7f9] dark:bg-[#0e1628]" />
        </Row>
        {FIELDS.slice(2).map((f) => (
          <Row key={f.key} label={f.label} htmlFor={f.key} required error={errors[f.key]}>
            <Input id={f.key} value={v[f.key]} readOnly={!init.canEdit} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} />
          </Row>
        ))}
        <Row label="Status" htmlFor="status">
          <Input id="status" value={init.status} readOnly className="bg-[#f6f7f9] dark:bg-[#0e1628]" />
        </Row>
        {init.accountType && (
          <Row label="Account Type" htmlFor="accountType">
            <Input id="accountType" value={init.accountType} readOnly className="bg-[#f6f7f9] dark:bg-[#0e1628]" />
          </Row>
        )}
      </div>
    </FormShell>
  );
}

export default function OrgAccountForm({ id }: { id: string }) {
  const { data, error } = useInit<OrgAccountInit>(`${API}/${encodeURIComponent(id)}`);
  if (error) return <p className="p-6 text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#535768] dark:text-[#aab3c5]">Loading…</p>;
  return <Editor init={data} id={id} />;
}
