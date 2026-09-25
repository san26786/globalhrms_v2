"use client";

import { createContext, useContext, useEffect, useState } from "react";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { authFetch } from "@/lib/auth/authFetch";
import { useOptions } from "@/lib/lookups/useOptions";

/**
 * CI common/indp_mst_data initForm (add / edit of an independent master).
 *
 * Controls (CI → here): Type (fixed and hidden when opened from a type's list), Master Code (with
 * the read-only organisation prefix of non-system types), Master Name, Description, Country; for the
 * system administrator also Set Parent Type → Select Parent, Link to Global Settings → Global
 * Settings, Link to Menu → Menu (Module Function / Functional Epic types only) and the Brand.
 * All rules are validated by /api/common/master-data; field errors come back onto the form.
 */

export interface MasterTypeInfo {
  typeId: number;
  typeCode: string;
  typeName: string;
  tableType: string | null;
  isSystem: boolean;
  userCanCreateData: boolean;
  isEditable: boolean;
  parentTypeId: number | null;
}

export interface MasterDataMeta {
  typeId: number | null;
  title: string;
  type: MasterTypeInfo | null;
  isSysAdmin: boolean;
  codePrefix: string;
  defaultCountryId: number | null;
  canSync: boolean;
  permissions: { create: boolean; update: boolean; delete: boolean };
}

/** Loads /api/common/master-data/meta for a type (null = all masters). */
export function useMasterDataMeta(typeId: number | null): { meta: MasterDataMeta | null; error: string | null } {
  const key = typeId ?? 0;
  const [state, setState] = useState<{ key: number; meta: MasterDataMeta | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/common/master-data/meta${typeId ? `?typeId=${typeId}` : ""}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Failed to load the master type.");
        setState({ key, meta: json.data as MasterDataMeta, error: null });
      })
      .catch((e) => !cancelled && setState({ key, meta: null, error: e instanceof Error ? e.message : "Failed to load the master type." }));
    return () => {
      cancelled = true;
    };
  }, [key, typeId]);

  const current = state?.key === key ? state : null;
  return { meta: current?.meta ?? null, error: current?.error ?? null };
}

/** `?typeId=` suffix for the list / add / edit URLs. */
export function typeQuery(typeId: number | null | undefined): string {
  return typeId ? `?typeId=${typeId}` : "";
}

interface MasterForm {
  typeId: string;
  code: string;
  codePrefix: string;
  name: string;
  description: string;
  countryId: string;
  hasParent: boolean;
  parentId: string;
  linkGlobalSettings: boolean;
  globalSettingId: string;
  linkMenu: boolean;
  menuId: string;
  oaBrandId: string;
}

interface MasterDto {
  typeId: number;
  codeInput: string;
  codePrefix: string;
  name: string;
  description: string | null;
  countryId: number | null;
  parentId: number | null;
  globalSettingId: number | null;
  menuId: number | null;
  oaBrandId: number | null;
}

interface FormContextValue {
  meta: MasterDataMeta;
  fixedTypeId: number | null;
  mode: "add" | "edit";
}

const MasterFormContext = createContext<FormContextValue | null>(null);

function useMasterDataFields(values: MasterForm): DynamicField[] {
  const ctx = useContext(MasterFormContext);
  const meta = ctx?.meta;
  const sysAdmin = !!meta?.isSysAdmin;
  const typeId = values.typeId;

  const types = useOptions(ctx?.fixedTypeId ? null : "/api/common/master-data/options?kind=types");
  const countries = useOptions("/api/common/master-data/options?kind=countries");
  const parents = useOptions(sysAdmin && typeId ? `/api/common/master-data/options?kind=parents&typeId=${typeId}` : null);
  const globalSettings = useOptions(sysAdmin ? "/api/common/master-data/options?kind=global-settings" : null);
  const menus = useOptions(sysAdmin && typeId ? `/api/common/master-data/options?kind=menus&typeId=${typeId}` : null);
  const brands = useOptions(sysAdmin && ctx?.mode === "add" && !meta?.type?.isSystem ? "/api/lookups/brands" : null);

  const prefix = values.codePrefix || meta?.codePrefix || "";

  return [
    {
      name: "typeId",
      label: "Type",
      type: "select",
      required: true,
      options: types.options,
      hidden: !!ctx?.fixedTypeId,
    },
    { name: "code", label: prefix ? `Master Code (prefix ${prefix})` : "Master Code", type: "text", required: true, placeholder: "Letters and numbers, max 10" },
    { name: "name", label: "Master Name", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "countryId", label: "Country", type: "select", options: countries.options },
    ...(sysAdmin
      ? ([
          { name: "hasParent", label: "Set Parent Type", type: "checkbox" },
          { name: "parentId", label: "Select Parent", type: "select", options: parents.options, hidden: !values.hasParent },
          { name: "linkGlobalSettings", label: "Link to Global Settings", type: "checkbox" },
          {
            name: "globalSettingId",
            label: "Global Settings",
            type: "select",
            options: globalSettings.options,
            hidden: !values.linkGlobalSettings,
          },
          { name: "linkMenu", label: "Link to Menu", type: "checkbox", hidden: menus.options.length === 0 && !values.linkMenu },
          { name: "menuId", label: "Menu", type: "select", options: menus.options, hidden: !values.linkMenu },
          {
            name: "oaBrandId",
            label: "Brand",
            type: "select",
            options: brands.options,
            hidden: ctx?.mode !== "add" || brands.options.length <= 1,
          },
        ] satisfies DynamicField[])
      : []),
  ];
}

function toPayload(values: MasterForm, sysAdmin: boolean) {
  return {
    typeId: values.typeId,
    code: values.code,
    name: values.name,
    description: values.description,
    countryId: values.countryId || null,
    ...(sysAdmin
      ? {
          parentId: values.hasParent ? values.parentId || null : null,
          globalSettingId: values.linkGlobalSettings ? values.globalSettingId || null : undefined,
          menuId: values.linkMenu ? values.menuId || null : undefined,
          oaBrandId: values.oaBrandId || undefined,
        }
      : {}),
  };
}

function toForm(dto: MasterDto): MasterForm {
  return {
    typeId: String(dto.typeId),
    code: dto.codeInput ?? "",
    codePrefix: dto.codePrefix ?? "",
    name: dto.name ?? "",
    description: dto.description ?? "",
    countryId: dto.countryId ? String(dto.countryId) : "",
    hasParent: !!dto.parentId,
    parentId: dto.parentId ? String(dto.parentId) : "",
    linkGlobalSettings: !!dto.globalSettingId,
    globalSettingId: dto.globalSettingId ? String(dto.globalSettingId) : "",
    linkMenu: !!dto.menuId,
    menuId: dto.menuId ? String(dto.menuId) : "",
    oaBrandId: dto.oaBrandId ? String(dto.oaBrandId) : "",
  };
}

interface Props {
  mode: "add" | "edit";
  id?: string;
  /** `?typeId=` of the page (CI $pvi_CmnTypID); null when opened from the all-masters list. */
  typeId: number | null;
}

export default function MasterDataFormPage({ mode, id, typeId }: Props) {
  const { meta, error } = useMasterDataMeta(typeId);

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!meta) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const title = typeId ? meta.title : "Masters Data";
  const listPath = `/common/master-data${typeQuery(typeId)}`;

  return (
    <MasterFormContext.Provider value={{ meta, fixedTypeId: typeId, mode }}>
      <ResourceFormPage<MasterForm, MasterDto>
        title={mode === "add" ? `Add ${title}` : `Edit ${title}`}
        breadcrumb={["Master Data Manager", meta.title]}
        mode={mode}
        id={id}
        apiPath="/api/common/master-data"
        basePath={listPath}
        useFields={useMasterDataFields}
        defaultValues={{
          typeId: typeId ? String(typeId) : "",
          code: "",
          codePrefix: "",
          name: "",
          description: "",
          countryId: meta.defaultCountryId ? String(meta.defaultCountryId) : "",
          hasParent: false,
          parentId: "",
          linkGlobalSettings: false,
          globalSettingId: "",
          linkMenu: false,
          menuId: "",
          oaBrandId: "",
        }}
        toForm={toForm}
        toPayload={(v) => toPayload(v, meta.isSysAdmin)}
      />
    </MasterFormContext.Provider>
  );
}
