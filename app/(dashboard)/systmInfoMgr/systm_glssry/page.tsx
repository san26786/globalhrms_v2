"use client";

import ResourceListPage from "@/components/resource/ResourceListPage";

interface GlossaryRow {
  id: number;
  code: string;
  meaning: string;
  description: string | null;
}

/** CI systmInfoMgr/systm_glssry::index() — list view of systm_glssry_vw. */
export default function SystemGlossaryPage() {
  return (
    <ResourceListPage<GlossaryRow>
      title="System Glossary"
      entity="systm-glssry"
      objectName="systm_glssry_vw"
      apiPath="/api/systmInfoMgr/systm_glssry"
      basePath="/systmInfoMgr/systm_glssry"
      getId={(r) => r.id}
      searchPlaceholder="Search code, meaning or description..."
      columns={[
        { key: "code", header: "Glossary Code", sortKey: "GLSSRY_CD" },
        { key: "meaning", header: "Glossary Meaning", sortKey: "GLSSRY_MNNG" },
        { key: "description", header: "Description" },
      ]}
    />
  );
}
