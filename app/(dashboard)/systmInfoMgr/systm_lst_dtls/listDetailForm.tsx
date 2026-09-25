"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";

/** CI systm_lst_dtls initForm: Table Name, Last Number. */
interface ListDetailForm {
  tableName: string;
  lastNumber: string;
}

const fields: DynamicField[] = [
  { name: "tableName", label: "Table Name", type: "text", required: true },
  { name: "lastNumber", label: "Last Number", type: "number", required: true },
];

export default function ListDetailFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<ListDetailForm, { tableName: string; lastNumber: number }>
      title={mode === "add" ? "Add System List Details" : "Edit System List Details"}
      breadcrumb={["System Information", "System List Details"]}
      mode={mode}
      id={id}
      apiPath="/api/systmInfoMgr/systm_lst_dtls"
      basePath="/systmInfoMgr/systm_lst_dtls"
      fields={fields}
      defaultValues={{ tableName: "", lastNumber: "" }}
      toForm={(dto) => ({ tableName: dto.tableName, lastNumber: String(dto.lastNumber) })}
    />
  );
}
