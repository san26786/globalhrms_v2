"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileDown, FileSpreadsheet, FileText, IdCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import type { ListAction } from "@/components/listview/ListViewShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { authFetch } from "@/lib/auth/authFetch";
import { EMP_SCREENS, type EmpFilterModel, type EmpRow, type EmpScreen } from "@/lib/employeeMngt/empTypes";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import { useInit } from "../../../systmMngt/_shared/useInit";

/**
 * CI employeeMngt/emp_mst::index() ("Employee Manager") / ::MyTeamEmployee() ("Team Employee Manager")
 * (listview_v): Employee Status (default Current), As of Date, Department and Manager filters, then the employee list
 * with the columns of CI's emp_manager_new_vw — their labels and visibility follow its Form Settings — and a search box
 * under every column. Row actions: Edit, Complete HR Process (Employee Manager), Delete (admins). Admin toolbar:
 * Employee Manager — Generate Appraisal Report, Generate ESR CSV / Excel / PDF Report, Update Employees with current
 * settings (selected rows); Team Employee Manager — Generate ESR Report. The ESR reports are as of the As of Date.
 * Rules and scoping: lib/employeeMngt/empList, lib/employeeMngt/empReports.
 */
const API = "/api/employeeMngt/emp_mst";
const ANY = "0";

/** CI listview showed Y-m-d values as dd.mm.yyyy. */
const ddmmyyyy = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join(".") : (v ?? ""));
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

/** Downloads a file from the API (the response's file name), or shows its error. */
async function download(url: string, fallbackName: string) {
  try {
    const res = await authFetch(url);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null;
      throw new Error(json?.errors ? Object.values(json.errors)[0]?.[0] : (json?.message ?? "The report could not be made."));
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "The report could not be made.");
  }
}

export default function EmployeeList({ screen }: { screen: EmpScreen }) {
  const config = EMP_SCREENS[screen];
  const router = useRouter();
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  const { data: filters, error } = useInit<EmpFilterModel>(`${API}/filters?screen=${screen}`);
  const [status, setStatus] = useState<string | null>(null);
  const [department, setDepartment] = useState(ANY);
  const [manager, setManager] = useState(ANY);
  // CI: Employee Manager opens with today's date, Team Employee Manager with an empty box.
  const [asOf, setAsOf] = useState(screen === "all" ? todayIso() : "");

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
  const dateParam = asOf ? `&date=${encodeURIComponent(asOf)}` : "";

  // CI listActions (admins only).
  const listActions: ListAction[] = !admin
    ? []
    : screen === "team"
      ? [{ key: "esr", title: "Generate ESR Report", icon: FileDown, onClick: () => download(`${API}/reports/esr?format=csv&screen=team${dateParam}`, "ESR.csv") }]
      : [
          { key: "appraisal", title: "Generate Appraisal Report", icon: ClipboardList, onClick: () => download(`${API}/reports/appraisal`, "appraisalReport.csv") },
          { key: "esr-csv", title: "Generate ESR CSV Report", icon: FileDown, onClick: () => download(`${API}/reports/esr?format=csv${dateParam}`, "ESR.csv") },
          { key: "esr-xlsx", title: "Generate ESR Excel Report", icon: FileSpreadsheet, onClick: () => download(`${API}/reports/esr?format=xlsx${dateParam}`, "ESR.xlsx") },
          { key: "esr-pdf", title: "Generate ESR PDF Report", icon: FileText, onClick: () => download(`${API}/reports/esr?format=pdf${dateParam}`, "ESR.pdf") },
        ];

  const updateSettings = async (rows: EmpRow[], refresh: () => void) => {
    try {
      const res = await authFetch(`${API}/update-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => r.id) }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: { count: number; skipped: number } } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The employees could not be updated.");
      toast.success(json.data?.skipped ? `${json.message} (${json.data.skipped} without a numeric employee code left unchanged)` : (json.message ?? "Employees Updated!!"));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The employees could not be updated.");
    }
  };

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
      columnSearch
      listActions={listActions}
      extraRowActions={
        screen === "all"
          ? [{ label: "Complete HR Process", icon: IdCard, onClick: (row) => router.push(`/employeeMngt/emp_hrprocess?emp=${row.id}`) }]
          : []
      }
      extraBulkActions={({ refresh, permissions }) =>
        screen === "all" && admin && permissions.update
          ? [{ label: "Update Employees with current settings", icon: RefreshCw, onClick: (rows) => updateSettings(rows, refresh) }]
          : []
      }
      toolbar={() =>
        filters.showFilters ? (
          <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-4 dark:border-white/10 dark:bg-[#111a2e]">
            <PlainSelect id="empStatus" label="Employee Status" value={statusValue} onChange={setStatus} options={opts(filters.statuses)} />
            <div className="space-y-1.5">
              <Label htmlFor="empAsOf" className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
                As of Date
              </Label>
              <Input id="empAsOf" type="date" className="h-9" max={todayIso()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
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
