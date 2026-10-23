"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI systmMngt/salary_component_settings::index() ("Salary Component"): list, Add New Salary
 * Component, and "Synced Salary Component" for brand admins. List: listDefinitions
 * 'salary_component_settings'; rules: lib/systmMngt/salaryComponentSettings.
 */

export default function SalaryComponentSettingsPage() {

  return <EntityListView list="salary_component_settings" />;
}
