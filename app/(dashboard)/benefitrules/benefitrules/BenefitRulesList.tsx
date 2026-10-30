"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import type { ListAction } from "@/components/listview/ListViewShell";
import { RULE_TYPES, isRuleTypeCode, type RuleListColumn, type RuleRow } from "@/lib/benefitrules/ruleTypes";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import { runAction } from "../../systmMngt/_shared/useInit";

/**
 * CI benefitrules/benefitrules::index($ruleCd) (listview_v): the type's rules with the columns of CI's
 * *_vw list view, Add New, row Edit / Delete, Delete Selected and — brand admins — "Sync Module"
 * (copy the system default rules). Rules: lib/benefitrules.
 */
const API = "/api/benefitrules/benefitrules";
const BASE = "/benefitrules/benefitrules";

const COLUMNS: Record<RuleListColumn, ResourceListColumn<RuleRow>> = {
  component: { key: "component", header: "Component", sortKey: "component" },
  section: { key: "section", header: "Section", sortKey: "section" },
  calculationFactor: { key: "calculationFactor", header: "Calculation Factor" },
  dependentOn: { key: "dependentOn", header: "Dependent On Component" },
  taxAllowanceType: { key: "taxAllowanceType", header: "Tax Allowance Type" },
  lowerLimit: { key: "lowerLimit", header: "Lower Limit", sortKey: "lowerLimit" },
  upperLimit: { key: "upperLimit", header: "Upper Limit" },
  values: { key: "values", header: "Values", sortKey: "values" },
  signFactor: { key: "signFactor", header: "Sign Factor" },
  openLimit: { key: "openLimit", header: "Open Limit" },
  gender: { key: "gender", header: "Gender" },
  month: { key: "month", header: "Month" },
  age: { key: "age", header: "Age" },
  expensesType: { key: "expensesType", header: "Expenses Type" },
  severeType: { key: "severeType", header: "Severe Type" },
  disabilityType: { key: "disabilityType", header: "Disability Type" },
  payment: { key: "payment", header: "Payment" },
  financialYear: { key: "financialYear", header: "Financial Year" },
  country: { key: "country", header: "Country" },
  comment: { key: "comment", header: "Comment" },
};

export default function BenefitRulesList({ type }: { type: string }) {
  const session = useCurrentSession();
  const [version, setVersion] = useState(0);
  if (!isRuleTypeCode(type)) return <p className="p-6 text-sm text-red-500">This rule type is not available.</p>;

  const config = RULE_TYPES[type];
  const columns = config.listColumns.map((c) => COLUMNS[c]);
  // Super admins see every brand's rules (CI getTableDtl), so the brand is shown too.
  if (session?.userLevel === 2) columns.push({ key: "brand", header: "Brand" });

  const listActions: ListAction[] =
    session?.userLevel === 1
      ? [
          {
            key: "sync",
            title: "Sync Module",
            icon: RefreshCw,
            onClick: async () => {
              const done = await runAction(`${API}/sync?type=${type}`, {
                method: "POST",
                confirm: "Copy the system default rules into this brand? Rules the brand already has are skipped.",
              });
              if (done) setVersion((v) => v + 1);
            },
          },
        ]
      : [];

  return (
    <ResourceListPage<RuleRow>
      key={`${type}-${version}`}
      title={config.title}
      entity={`benefit-rules-${type.toLowerCase()}`}
      apiPath={API}
      basePath={BASE}
      params={{ type }}
      columns={columns}
      getId={(row) => row.id}
      addHref={`${BASE}/add?type=${type}`}
      editHref={(row) => `${BASE}/edit/${row.id}`}
      listActions={listActions}
    />
  );
}
