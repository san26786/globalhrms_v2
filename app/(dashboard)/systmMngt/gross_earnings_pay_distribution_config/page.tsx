"use client";

import Link from "next/link";
import { Calculator, RefreshCw } from "lucide-react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { Button } from "@/components/ui/button";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { GrossEarningsModel } from "@/lib/systmMngt/grossEarnings";
import { runAction, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/gross_earnings_pay_distribution_config (formview_v): Annually / Monthly / Weekly /
 * Daily (%), Save, "Synced Module" (brand admins) and "Calculate Salary". Rules: lib/systmMngt/grossEarnings.
 */
const API = "/api/systmMngt/gross_earnings_pay_distribution_config";
const LABELS = { annually: "Annually", monthly: "Monthly", weekly: "Weekly", daily: "Daily" } as const;

export default function GrossEarningsConfigPage() {
  const { data, error, reload } = useInit<GrossEarningsModel>(API);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const fields: DynamicField[] = (Object.keys(LABELS) as Array<keyof typeof LABELS>).map((k) => ({
    name: k,
    label: `${LABELS[k]} (%)`,
    type: "text",
    required: true,
    disabled: !data.canSave,
  }));

  return (
    <ResourceFormPage<GrossEarningsModel["values"]>
      key={JSON.stringify(data.values)}
      title={data.title}
      breadcrumb={["System Manager", "Gross Earning Config"]}
      mode="edit"
      apiPath={API}
      basePath="/systmMngt/gross_earnings_pay_distribution_config"
      submitUrl={API}
      submitMethod="PUT"
      allowSaveAndAdd={false}
      fields={fields}
      defaultValues={data.values}
      onSaved={reload}
    >
      <div className="flex flex-wrap gap-2">
        {data.canSync && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              if (await runAction(API, { method: "POST", confirm: "Replace this brand's configuration with the system default?" })) reload();
            }}
          >
            <RefreshCw className="mr-1 h-4 w-4" /> Synced Module
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/systmMngt/gross_earnings_pay_distribution_calc">
            <Calculator className="mr-1 h-4 w-4" /> Calculate Salary
          </Link>
        </Button>
      </div>
    </ResourceFormPage>
  );
}
