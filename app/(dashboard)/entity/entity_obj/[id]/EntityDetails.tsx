"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Database, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authFetch } from "@/lib/auth/authFetch";
import ExistsBadge from "../../_components/ExistsBadge";
import AttributeListPage from "../../entity_obj_attrbt/attributeList";
import ObjMappingList from "../../obj_mppng/objMappingList";
import DependentDataList from "../../entity_obj_attrbt_dependent_data/dependentDataList";
import PrivilegeList from "../../obj_attrbt_previleges/privilegeList";
import DisplayConfigPanel from "./DisplayConfigPanel";
import type { EntityTab } from "./entityTabs";

interface EntityObj {
  id: number;
  objTyp: string;
  objNm: string;
  existsInDb: boolean;
  dbObjectType: string | null;
}

/** Entity object details with its attributes, column configuration and related definitions. */
export default function EntityDetails({ id, initialTab }: { id: string; initialTab: EntityTab }) {
  const router = useRouter();
  const [entity, setEntity] = useState<EntityObj | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EntityTab>(initialTab);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/entity/entity_obj/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Entity object not found.");
        setEntity(json.data as EntityObj);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Entity object not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const changeTab = (value: string) => {
    setTab(value as EntityTab);
    router.replace(`/entity/entity_obj/${id}?tab=${value}`, { scroll: false });
  };

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!entity) return <p className="p-6 text-sm text-gray-400">Loading...</p>;

  const summary: Array<[string, React.ReactNode]> = [
    ["Object Name", <span key="n" className="font-mono">{entity.objNm}</span>],
    ["Object Type", entity.objTyp],
    ["In Database", <ExistsBadge key="e" exists={entity.existsInDb} type={entity.dbObjectType} />],
    ["Database Object Type", entity.dbObjectType ?? "-"],
  ];

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Entity</span>
          <ChevronRight size={15} className="text-slate-400" />
          <Link href="/entity/entity_obj">Entity Object</Link>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">Details</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">{entity.objNm}</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="mapping">Mapping</TabsTrigger>
          <TabsTrigger value="dependency">Dependency</TabsTrigger>
          <TabsTrigger value="privileges">Privileges</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {summary.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href={`/entity/entity_obj/edit/${entity.id}`}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attributes">
          <AttributeListPage objNm={entity.objNm} basePath={`/entity/entity_obj/${entity.id}/attributes`} title="Attributes" />
        </TabsContent>

        <TabsContent value="display">
          <DisplayConfigPanel objId={entity.id} />
        </TabsContent>

        <TabsContent value="mapping">
          <ObjMappingList srcObjId={entity.id} title={`Mappings from ${entity.objNm}`} />
        </TabsContent>

        <TabsContent value="dependency">
          <DependentDataList objNm={entity.objNm} title={`Dependent data of ${entity.objNm}`} />
        </TabsContent>

        <TabsContent value="privileges">
          <PrivilegeList objId={entity.id} title={`Attribute privileges of ${entity.objNm}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
