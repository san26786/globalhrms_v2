"use client";

import { useMemo, useState } from "react";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { EMP_SCREENS, type EmpFilterModel, type EmpRow, type EmpScreen } from "@/lib/employeeMngt/empTypes";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import { useInit } from "../../../systmMngt/_shared/useInit";

/**
 * CI employeeMngt/emp_mst::index() ("Employee Manager") / ::MyTeamEmployee() ("Team Employee Manager")
 * (listview_v): Employee Status (default Current), Department and Manager filters, then the employee list
 * with the columns of CI's emp_manager_new_vw — their labels and visibility follow its Form Settings.
 * Rules and scoping: lib/employeeMngt/empList.
 */
const API = "/api/employeeMngt/emp_mst";
const ANY = "0";

/** CI listview showed Y-m-d values as dd.mm.yyyy. */
const ddmmyyyy = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join(".") : (v ?? ""));

const COLUMNS: ResourceListColumn<EmpRow>[] = [
  { key: "EMP_NBR", header: "Employee Code", attribute: "EMP_NBR", sortKey: "EMP_NBR" },
  { key: "TITLE_NM", header: "Title", attribute: "TITLE_NM" },
  { key: "EMP_NAME", header: "First Name", attribute: "EMP_NAME", sortKey: "EMP_NAME" },
  { key: "EMP_MIDDLE_NM", header: "Middle Name", attribute: "EMP_MIDDLE_NM" },
  { key: "EMPLST_NM", header: "Last Name", attribute: "EMPLST_NM", sortKey: "EMPLST_NM" },
  { key: "EMP_FULL_NAME", header: "Employee Full Name", attribute: "EMP_FULL_NAME", sortKey: "EMP_FULL_NAME" },
  { key: "EMP_INITIALS", header: "Employee Initials", attribute: "EMP_INITIALS" },
  { key: "IS_MANAGER", header: "Is Manager", attribute: "IS_MANAGER" },
  { key: "KNOWN_AS", header: "Known As", attribute: "KNOWN_AS" },
  { key: "MANAGER", header: "Manager", attribute: "MANAGER", sortKey: "MANAGER" },
  { key: "DOB", header: "Date Of Birth", attribute: "DOB", sortKey: "DOB", cell: (r) => ddmmyyyy(r.DOB) },
  { key: "DEPARTMENT", header: "Department", attribute: "DEPARTMENT", sortKey: "DEPARTMENT" },
  { key: "GENDER", header: "Gender", attribute: "GENDER" },
  { key: "EMAIL_ADD", header: "Email Address", attribute: "EMAIL_ADD" },
  { key: "FULL_PHONE_NBR", header: "Phone Number", attribute: "FULL_PHONE_NBR" },
  { key: "EMP_STATUS", header: "Employee Status", attribute: "EMP_STATUS", sortKey: "EMP_STATUS" },
];

export default function EmployeeList({ screen }: { screen: EmpScreen }) {
  const config = EMP_SCREENS[screen];
  const session = useCurrentSession();
  const { data: filters, error } = useInit<EmpFilterModel>(`${API}/filters?screen=${screen}`);
  const [status, setStatus] = useState<string | null>(null);
  const [department, setDepartment] = useState(ANY);
  const [manager, setManager] = useState(ANY);

  const statusValue = status ?? (filters?.currentStatusId ? String(filters.currentStatusId) : "");
  const params = useMemo(() => {
    const p: Record<string, string> = { screen };
    if (statusValue) p.status = statusValue;
    if (department !== ANY) p.department = department;
    if (manager !== ANY) p.manager = manager;
    return p;
  }, [screen, statusValue, department, manager]);

  const columns = useMemo(
    () => (session?.userLevel === 2 ? [...COLUMNS, { key: "OA_BRAND_CD", header: "Brand", attribute: "OA_BRAND_CD" } as ResourceListColumn<EmpRow>] : COLUMNS),
    [session?.userLevel],
  );

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!filters) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const opts = (list: Array<{ value: number; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

  return (
    <ResourceListPage<EmpRow>
      title={config.title}
      entity={screen === "team" ? "team-employee-manager" : "employee-manager"}
      objectName="emp_manager_new_vw"
      apiPath={API}
      basePath={config.base}
      params={params}
      columns={columns}
      getId={(row) => row.id}
      searchPlaceholder="Search code, name, e-mail, department…"
      addHref={`${EMP_SCREENS.all.base}/add`}
      editHref={(row) => `${config.base}/edit/${row.id}`}
      toolbar={() =>
        filters.showFilters ? (
          <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-white p-4 shadow-sm md:grid-cols-3">
            <PlainSelect id="empStatus" label="Employee Status" value={statusValue} onChange={setStatus} options={opts(filters.statuses)} />
            <PlainSelect
              id="empDepartment"
              label="Department"
              value={department}
              onChange={setDepartment}
              options={[{ value: ANY, label: "All departments" }, ...opts(filters.departments)]}
            />
            {filters.managers && (
              <PlainSelect
                id="empManager"
                label="Manager"
                value={manager}
                onChange={setManager}
                options={[{ value: ANY, label: "All managers" }, ...opts(filters.managers)]}
              />
            )}
          </div>
        ) : null
      }
    />
  );
}
