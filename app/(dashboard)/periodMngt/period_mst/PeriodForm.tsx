"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { toast } from "sonner";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { SETTINGS_VERIFY_HREF } from "@/lib/periodMngt/period.registry";
import type { PeriodFormInit, PeriodRecord, StartEndDates } from "@/lib/periodMngt/period.types";

/**
 * CI periodMngt/period_mst initForm (include/formview_v + js/periodMngt/period_mst.js):
 * Period Type, Period Start / End Date, Fiscal Period Description, and — edit only — Period Status
 * (add posts Active). Picking a period type fills the dates and description (CI getStartEndDate).
 * Edit of a not verified period shows CI's "Verify Period" button.
 */

const API = "/api/periodMngt/period_mst";
const LIST = "/periodMngt/period_mst";

interface PeriodFormValues {
  periodTypeId: string;
  periodStartDate: string;
  periodEndDate: string;
  fiscalPeriodDesc: string;
  periodStatusId: string;
}

/** The shared date picker holds an ISO timestamp of local midnight; the API speaks yyyy-MM-dd. */
const toPicker = (ymd: string | null) => (ymd ? parseISO(ymd).toISOString() : "");
const toYmd = (value: string) => (value ? format(new Date(value), "yyyy-MM-dd") : "");

const EMPTY: PeriodFormValues = { periodTypeId: "", periodStartDate: "", periodEndDate: "", fiscalPeriodDesc: "", periodStatusId: "" };

/** CI period_mst.js: #periodTypeId change → getStartEndDate → start, end, "{type}  {year}". */
function usePeriodTypeAutofill(form: UseFormReturn<PeriodFormValues>) {
  useEffect(() => {
    const sub = form.watch((values, { name, type }) => {
      // Only a user's change (not the edit record being loaded) fills the dates, as in CI.
      if (name !== "periodTypeId" || type !== "change" || !values.periodTypeId) return;
      authFetch(`${API}/start-end/${encodeURIComponent(values.periodTypeId)}`)
        .then(async (res) => {
          const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: StartEndDates } | null;
          if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Could not get the period dates.");
          form.setValue("periodStartDate", toPicker(json.data.periodStartDate), { shouldDirty: true });
          form.setValue("periodEndDate", toPicker(json.data.periodEndDate), { shouldDirty: true });
          form.setValue("fiscalPeriodDesc", json.data.fiscalPeriodDesc, { shouldDirty: true });
        })
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not get the period dates."));
    });
    return () => sub.unsubscribe();
  }, [form]);
}

function VerifyButton({ periodId, onVerified }: { periodId: number; onVerified: () => void }) {
  const [busy, setBusy] = useState(false);
  const [settingsLink, setSettingsLink] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/actions/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [periodId] }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; code?: string } | null;
      if (!res.ok || !json?.success) {
        setSettingsLink(json?.code === "PERIOD_SETTINGS_NOT_VERIFIED");
        throw new Error(json?.message ?? "Verify failed.");
      }
      toast.success(json.message ?? "Successfully Verified Period.");
      onVerified();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={busy} onClick={verify} className="rounded-full">
        <Check className="mr-1 h-4 w-4" /> Verify Period
      </Button>
      {settingsLink && (
        <span className="text-sm text-red-600">
          Please verify period settings first.{" "}
          <Link href={SETTINGS_VERIFY_HREF} target="_blank" className="font-medium underline">
            Click here
          </Link>{" "}
          to verify.
        </span>
      )}
    </div>
  );
}

export default function PeriodForm({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  const [init, setInit] = useState<PeriodFormInit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${API}/init${mode === "edit" && id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: PeriodFormInit } | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Failed to load the form.");
        if (!cancelled) setInit(json.data);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load the form."));
    return () => {
      cancelled = true;
    };
  }, [mode, id]);

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!init) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const toOptions = (list: PeriodFormInit["periodTypes"]) => list.map((o) => ({ value: String(o.value), label: o.label }));
  const fields: DynamicField[] = [
    { name: "periodTypeId", label: "Period Type", type: "select", required: true, attribute: "PERIOD_TYPE_ID", options: toOptions(init.periodTypes) },
    { name: "periodStartDate", label: "Period Start Date", type: "date", required: true, attribute: "PERIOD_START_DATE" },
    { name: "periodEndDate", label: "Period End Date", type: "date", required: true, attribute: "PERIOD_END_DATE" },
    { name: "fiscalPeriodDesc", label: "Fiscal Period Description", type: "textarea", required: true, attribute: "FISCAL_PERIOD_DESC" },
    ...(mode === "edit"
      ? [{ name: "periodStatusId", label: "Period Status", type: "select", attribute: "PERIOD_STATUS_ID", options: toOptions(init.periodStatuses) }]
      : []),
  ];

  return (
    <ResourceFormPage<PeriodFormValues, PeriodRecord>
      title={init.title}
      breadcrumb={["Period Manager", "Period Master"]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath={LIST}
      objectName="period_mst"
      fields={fields}
      defaultValues={EMPTY}
      toForm={(r) => ({
        periodTypeId: r.periodTypeId ? String(r.periodTypeId) : "",
        periodStartDate: toPicker(r.periodStartDate),
        periodEndDate: toPicker(r.periodEndDate),
        fiscalPeriodDesc: r.fiscalPeriodDesc ?? "",
        periodStatusId: r.periodStatusId ? String(r.periodStatusId) : "",
      })}
      toPayload={(v) => ({
        periodTypeId: v.periodTypeId,
        periodStartDate: toYmd(v.periodStartDate),
        periodEndDate: toYmd(v.periodEndDate),
        fiscalPeriodDesc: v.fiscalPeriodDesc,
        ...(mode === "edit" ? { periodStatusId: v.periodStatusId } : {}),
      })}
      useFormEffects={usePeriodTypeAutofill}
    >
      {init.canVerify && init.record && !verified && (
        <VerifyButton periodId={init.record.periodId} onVerified={() => setVerified(true)} />
      )}
    </ResourceFormPage>
  );
}
