"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI salaryComponentMember/salarycomponentmember::index() ("Component Member"): list, Add New and
 * row edit / delete. List: listDefinitions 'salary_component_member'; rules: lib/salaryComponentMember.
 */
export default function SalaryComponentMemberPage() {
  return <EntityListView list="salary_component_member" />;
}
