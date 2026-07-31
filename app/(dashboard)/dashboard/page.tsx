import DashboardTabs from "@/components/layout/DashboardTabs";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

export default function DashboardPage() {
  return (
    <>
      <DashboardTabs />
      <EmployeeDashboard />
    </>
  );
}