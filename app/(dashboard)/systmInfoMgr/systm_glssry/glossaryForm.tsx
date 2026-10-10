"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";

/** CI systm_glssry initForm: code, meaning, description. */
interface GlossaryForm {
  code: string;
  meaning: string;
  description: string;
}

const fields: DynamicField[] = [
  { name: "code", label: "Glossary Code", type: "text", required: true },
  { name: "meaning", label: "Glossary Meaning", type: "text", required: true },
  { name: "description", label: "Glossary Description", type: "text" },
];

export default function GlossaryFormPage({ mode, id }: { mode: "add" | "edit"; id?: string }) {
  return (
    <ResourceFormPage<GlossaryForm>
      title={mode === "add" ? "Add System Glossary" : "Edit System Glossary"}
      breadcrumb={["System Information", "System Glossary"]}
      mode={mode}
      id={id}
      apiPath="/api/systmInfoMgr/systm_glssry"
      basePath="/systmInfoMgr/systm_glssry"
      fields={fields}
      defaultValues={{ code: "", meaning: "", description: "" }}
      toForm={(dto) => ({ code: dto.code, meaning: dto.meaning, description: dto.description ?? "" })}
    />
  );
}
