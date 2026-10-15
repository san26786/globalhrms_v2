"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import FormShell, { Row } from "../_shared/FormShell";
import { saveForm, useInit } from "../_shared/useInit";

/** CI viewEmployee_payment_details_v: "Update Employee Payment Details" — the Additional Comments field. */
const API = "/api/systmMngt/employee_payment_details";
const LIST = "/systmMngt/employee_payment_details";

function Editor({ id, title, initial }: { id: string; title: string; initial: string }) {
  const router = useRouter();
  const [addComments, setAddComments] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await saveForm(`${API}/${encodeURIComponent(id)}`, "PUT", { addComments });
    setBusy(false);
    if (!r.ok) return setError(r.errors.addComments);
    router.push(LIST);
  };

  return (
    <FormShell title={title} breadcrumb={["System Manager", "Payroll Processing"]} mode="edit" busy={busy} onSave={save} onCancel={() => router.push(LIST)}>
      <Row label="Additional Comments" htmlFor="addComments" error={error}>
        <Input id="addComments" autoComplete="off" value={addComments} onChange={(e) => setAddComments(e.target.value)} />
      </Row>
    </FormShell>
  );
}

export default function PaymentCommentsForm({ id }: { id: string }) {
  const { data, error } = useInit<{ title: string; addComments: string }>(`${API}/${encodeURIComponent(id)}`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;
  return <Editor id={id} title={data.title} initial={data.addComments} />;
}
