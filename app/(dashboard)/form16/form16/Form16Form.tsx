"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";
import { Eye, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { HUB_DEFS } from "@/lib/employeeMngt/hub/hubDefs";
import { fieldIsHidden, fieldIsRequired } from "@/lib/employeeMngt/hub/hubFields";
import type { HubFormModel, HubOption, HubValues } from "@/lib/employeeMngt/hub/hubTypes";
import type { EmployeeForm16Details } from "@/lib/payroll/form16/shared";
import { useInit } from "../../systmMngt/_shared/useInit";
import { FORM16_LIST, generateForm16, previewForm16 } from "./form16Client";

/**
 * CI form16/form16::initForm (formview_v): Employee Name, Period, Financial Period, Address1–3, Postal Code, City,
 * Country, Salary, Applicable Tax, Pan, Tan. As CI form16.js, picking the employee fills the salary (job gross
 * salary) and the address fields from the employee's records; those fields are read-only. On edit, CI's form buttons
 * "Save and Preview" (save, then the Form 16 PDF) and "Save And Generate" (save, the PDF as a file, back to the list);
 * the quarters table is below the form (Form16Quarters). Rules: lib/employeeMngt/hub/screens/form16.ts.
 *
 * Behaviour changes: the employee is fixed on edit (Employee Hub rule; CI let it change) — "Refresh from employee"
 * re-reads their address and salary instead; an address part the employee's address lacks (or every part, without an
 * address) can be typed and the form says so (CI filled "0" into it to pass its required rule); the country is set
 * too (CI put the country's name into an id-valued list, which selected nothing); a viewer without the edit grant
 * gets "Preview Form-16" (the PDF for the years chosen on the form, nothing saved — CI offered the PDF only with a save).
 */
const API = "/api/employeeMngt/form16";
const defs = HUB_DEFS.form16;

const opts = (list: HubOption[] | undefined) => (list ?? []).map((o) => ({ value: String(o.value), label: o.label }));
const failed = (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create the Form 16.");

/** The read-only address parts, with their labels (CI getEmpAddress / T / Th, getPostalCode, getcity). */
const ADDRESS_PARTS: Array<[field: string, key: keyof EmployeeForm16Details, label: string]> = [
  ["ADDRESS1", "address1", "Address1"],
  ["ADDRESS2", "address2", "Address2"],
  ["ADDRESS3", "address3", "Address3"],
  ["POSTAL_CODE", "postalCode", "Postal Code"],
  ["CITY", "city", "City"],
];

/** CI getEmpSal / getEmpAddress / … : the employee's details into the form; returns the address parts left empty. */
async function fillFromEmployee(form: UseFormReturn<HubValues>, employee: string, recordId?: string): Promise<string[]> {
  const query = new URLSearchParams({ emp: employee, ...(recordId ? { id: recordId } : {}) });
  const res = await authFetch(`${API}/employee-options?${query}`);
  const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: { extras?: Record<string, Record<string, unknown>> } } | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not load the employee's details.");
  const d = json.data?.extras?.employee?.[employee] as EmployeeForm16Details | undefined;
  if (!d) return [];
  const set = (name: string, value: string) => form.setValue(name, value, { shouldDirty: true });
  set("SALARY", d.salary);
  for (const [field, key] of ADDRESS_PARTS) set(field, String(d[key] ?? ""));
  if (d.country) set("COUNTRY", d.country);
  const missing = ADDRESS_PARTS.filter(([, key]) => !d[key]);
  if (d.noAddress) toast.warning("This employee has no address on file: type it here, or add it under Employee Hub › Address and pick the employee again.");
  else if (missing.length) toast.warning(`The employee's address has no ${missing.map(([, , label]) => label).join(", ")}: type it here.`);
  return missing.map(([field]) => field);
}

export default function Form16Form({ mode, id, emp }: { mode: "add" | "edit"; id?: string; emp?: string }) {
  const router = useRouter();
  const formRef = useRef<UseFormReturn<HubValues> | null>(null);
  const filledFor = useRef<string | null>(null);
  // Address parts the employee's address left empty: typed by hand (the rest stay read-only, as CI).
  const [typed, setTyped] = useState<string[]>([]);
  const { data, error } = useInit<HubFormModel>(id ? `${API}/form?id=${encodeURIComponent(id)}` : `${API}/form`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const defaults: HubValues = { EMP_ID: data.restricted ? String(data.ownEmployeeId ?? "") : (emp ?? "") };
  for (const f of defs.fields) defaults[f.name] = "";
  Object.assign(defaults, data.defaults);

  const useFields = (v: HubValues): DynamicField[] => [
    {
      name: "EMP_ID",
      label: defs.employeeLabel ?? "Employee Name",
      type: "select",
      options: opts(data.employees),
      required: true,
      // CI: a normal user's list holds only themself; fixed on edit (Employee Hub rule).
      disabled: data.restricted || mode === "edit",
    },
    ...defs.fields.map(
      (f): DynamicField => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: fieldIsRequired(f, v, data.flags),
        options: f.type === "select" && f.options ? opts(data.options[f.options]) : undefined,
        hidden: fieldIsHidden(f, v, data.flags),
        disabled: !!f.readOnly?.(v, data.flags) && !typed.includes(f.name),
        attribute: f.attribute,
      }),
    ),
  ];

  // CI form16.js: a picked employee fills salary and address (on add; the record keeps its employee on edit).
  const useFormEffects = (form: UseFormReturn<HubValues>) => {
    formRef.current = form;
    const employee = String(form.watch("EMP_ID") ?? "");
    useEffect(() => {
      if (mode !== "add" || !employee || filledFor.current === employee) return;
      filledFor.current = employee;
      fillFromEmployee(form, employee).then(setTyped).catch((e) => toast.error(e instanceof Error ? e.message : "Could not load the employee's details."));
    }, [employee, form]);
  };

  const periods = () => ({
    period: String(formRef.current?.getValues("PERIOD_ID") ?? ""),
    fy: String(formRef.current?.getValues("FINANCIAL_PERIOD_ID") ?? ""),
  });
  const savedId = (saved: unknown) => (saved as { id?: number } | null)?.id ?? id ?? "";

  // CI initForm: the buttons exist on edit only.
  const extraSaves =
    mode === "edit" && data.canSave
      ? [
          { key: "SaveAndPreview", label: "Save and Preview", icon: Eye, after: (saved: unknown) => void previewForm16(savedId(saved), periods()).catch(failed) },
          {
            key: "SaveAndGenerate",
            label: "Save And Generate",
            icon: FileDown,
            after: (saved: unknown) =>
              void generateForm16(savedId(saved), periods())
                .then(() => router.push(FORM16_LIST))
                .catch(failed),
          },
        ]
      : [];

  const refresh = () => {
    const form = formRef.current;
    if (!form) return;
    fillFromEmployee(form, String(form.getValues("EMP_ID") ?? ""), id)
      .then((missing) => {
        setTyped(missing);
        toast.success("Address and salary re-read from the employee's records.");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load the employee's details."));
  };

  return (
    <ResourceFormPage<HubValues>
      title={mode === "add" ? "Add New Form-16" : "Edit Form-16"}
      breadcrumb={["Payroll", "Form-16"]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath={FORM16_LIST}
      objectName="form16_vw"
      useFields={useFields}
      defaultValues={defaults}
      allowSaveAndAdd
      saveAndAddOnEdit
      addHref={`${FORM16_LIST}/add`}
      canSubmit={data.canSave}
      extraSaves={extraSaves}
      useFormEffects={useFormEffects}
    >
      {mode === "edit" && data.canSave ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh from employee
          </Button>
        </div>
      ) : null}
      {mode === "edit" && id && !data.canSave ? (
        // Read-only (no edit grant, e.g. an employee viewing their own): the PDF without saving.
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void previewForm16(id, periods()).catch(failed)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview Form-16
          </Button>
        </div>
      ) : null}
    </ResourceFormPage>
  );
}
