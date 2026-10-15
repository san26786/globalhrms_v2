"use client";

import { RefreshCw } from "lucide-react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { Button } from "@/components/ui/button";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import type { PayComponentConfigModel } from "@/lib/systmMngt/payComponentConfig";
import { runAction, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/payComponentTypeConfig (formview_v): Fixed / Variable / Constant / Contribution (%),
 * Save, and "Sync Module" for brand admins. Rules: lib/systmMngt/payComponentConfig.
 */
const API = "/api/systmMngt/payComponentTypeConfig";

export default function PayComponentTypeConfigPage() {
  const { data, error, reload } = useInit<PayComponentConfigModel>(API);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const fields: DynamicField[] = data.fields.map((f) => ({
    name: f.key,
    label: `${f.label} (%)`,
    type: "text",
    required: true,
    disabled: !data.canSave,
  }));

  return (
    <ResourceFormPage<Record<string, string>>
      key={JSON.stringify(data.fields)}
      title={data.title}
      breadcrumb={["System Manager", "Pay Component Config"]}
      mode="edit"
      apiPath={API}
      basePath="/systmMngt/payComponentTypeConfig"
      submitUrl={API}
      submitMethod="PUT"
      allowSaveAndAdd={false}
      fields={fields}
      defaultValues={Object.fromEntries(data.fields.map((f) => [f.key, f.value]))}
      onSaved={reload}
    >
      {data.canSync && (
        <div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              if (await runAction(API, { method: "POST", confirm: "Replace this brand's pay component configuration with the system defaults?" })) reload();
            }}
          >
            <RefreshCw className="mr-1 h-4 w-4" /> Sync Module
          </Button>
        </div>
      )}
    </ResourceFormPage>
  );
}
