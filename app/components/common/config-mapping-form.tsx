"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI common/config_mapping_dtl initForm: Mapping Type radio (Menu Mapping – module / epic, GS
 * Mapping, Board Type) → source entity and target entity of that mapping. Validation (existence of
 * the masters, unique source→target combination) is done by /api/common/config-mapping.
 */
type MappingKind = "module_menu" | "epic_menu" | "global_setting" | "board_type";

/** Source / target master types per mapping kind (CI MODULEID/EPICID/GLOBALSETTINGSID/REQUIREMENTTYPEID/BOARDTYPEID). */
const KINDS: Record<MappingKind, { label: string; mappingTypeId: number; sourceTypeId: number; sourceLabel: string; targetTypeId: number; targetLabel: string }> = {
  module_menu: { label: "Menu Mapping (Module)", mappingTypeId: 83, sourceTypeId: 76, sourceLabel: "Module Function", targetTypeId: 83, targetLabel: "Menu" },
  epic_menu: { label: "Menu Mapping (Epic)", mappingTypeId: 84, sourceTypeId: 77, sourceLabel: "Functional Area", targetTypeId: 84, targetLabel: "Menu" },
  global_setting: { label: "GS Mapping", mappingTypeId: 36, sourceTypeId: 77, sourceLabel: "Functional Area", targetTypeId: 36, targetLabel: "Global Settings" },
  board_type: { label: "Board Type", mappingTypeId: 254, sourceTypeId: 222, sourceLabel: "Requirement Type", targetTypeId: 254, targetLabel: "Board Type" },
};

export function kindForMappingType(typeId: number | null): MappingKind | "" {
  const entry = (Object.entries(KINDS) as Array<[MappingKind, (typeof KINDS)[MappingKind]]>).find(([, v]) => v.mappingTypeId === typeId);
  return entry ? entry[0] : "";
}

interface MappingForm {
  mappingKind: MappingKind | "";
  sourceId: string;
  targetId: string;
}

interface MappingDto {
  mappingKind: MappingKind | null;
  sourceId: number;
  targetId: number;
}

function useMappingFields(values: MappingForm): DynamicField[] {
  const kind = values.mappingKind ? KINDS[values.mappingKind] : null;
  const sources = useOptions(kind ? `/api/lookups/masters?typeId=${kind.sourceTypeId}` : null);
  const targets = useOptions(kind ? `/api/lookups/masters?typeId=${kind.targetTypeId}` : null);

  return [
    {
      name: "mappingKind",
      label: "Mapping Type",
      type: "radio",
      required: true,
      options: (Object.entries(KINDS) as Array<[MappingKind, (typeof KINDS)[MappingKind]]>).map(([value, k]) => ({ value, label: k.label })),
    },
    { name: "sourceId", label: kind?.sourceLabel ?? "Source Entity", type: "select", required: true, options: sources.options },
    { name: "targetId", label: kind?.targetLabel ?? "Target Entity", type: "select", required: true, options: targets.options },
  ];
}

export default function ConfigMappingFormPage({ mode, id, typeId }: { mode: "add" | "edit"; id?: string; typeId: number | null }) {
  const listPath = `/common/config-mapping${typeId ? `?typeId=${typeId}` : ""}`;
  return (
    <ResourceFormPage<MappingForm, MappingDto>
      title={mode === "add" ? "New Config Mapping Details" : "Edit Config Mapping Details"}
      breadcrumb={["Master Data Manager", "Config and Mapping"]}
      mode={mode}
      id={id}
      apiPath="/api/common/config-mapping"
      basePath={listPath}
      useFields={useMappingFields}
      defaultValues={{ mappingKind: kindForMappingType(typeId), sourceId: "", targetId: "" }}
      toForm={(dto) => ({ mappingKind: dto.mappingKind ?? "", sourceId: String(dto.sourceId), targetId: String(dto.targetId) })}
    />
  );
}
