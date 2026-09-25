"use client";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";

export interface AttributeRow {
  id: number;
  objNm: string;
  objAttrbtNm: string;
  objAttrbtDtTyp: string;
  objAttrbtSeq: number;
  isNull: string;
  objSz: number | null;
  isVisible: boolean;
}

interface Props {
  objNm?: string;
  /** Base path for add/edit links (defaults to the stand-alone screen). */
  basePath?: string;
  title?: string;
}

/** Attribute list — stand-alone (CI entity_obj_attrbt/index/{OBJ_NM}) or the entity's Attributes tab. */
export default function AttributeListPage({ objNm, basePath = "/entity/entity_obj_attrbt", title }: Props) {
  const columns: ResourceListColumn<AttributeRow>[] = [
    ...(objNm ? [] : [{ key: "objNm", header: "Object Name", sortKey: "OBJ_NM" } satisfies ResourceListColumn<AttributeRow>]),
    { key: "objAttrbtNm", header: "Attribute Name", sortKey: "OBJ_ATTRBT_NM" },
    { key: "objAttrbtDtTyp", header: "Data Type", sortKey: "OBJ_ATTRBT_DT_TYP" },
    { key: "objAttrbtSeq", header: "Sequence", sortKey: "OBJ_ATTRBT_SEQ" },
    { key: "isNull", header: "Is Null" },
    { key: "objSz", header: "Size" },
    { key: "isVisible", header: "Visible", cell: (r) => (r.isVisible ? "Yes" : "No") },
  ];

  return (
    <ResourceListPage<AttributeRow>
      title={title ?? (objNm ? `Entity Object Attribute: ${objNm}` : "Entity Object Attribute")}
      entity="entity-obj-attrbt"
      apiPath="/api/entity/entity_obj_attrbt"
      basePath={basePath}
      getId={(r) => r.id}
      params={objNm ? { objNm } : undefined}
      searchPlaceholder="Search attribute, object or data type..."
      columns={columns}
    />
  );
}
