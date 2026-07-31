import DashboardTabs from "@/components/layout/DashboardTabs";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

export default function EmployeePage() {
  return (
    <>
      <DashboardTabs />
      <EmployeeDashboard />
    </>
  );
}