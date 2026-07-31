import DashboardTabs from "@/components/layout/DashboardTabs";
import AttendanceDashboard from "@/components/dashboard/AttendanceDashboard";

export default function AttendancePage() {
  return (
    <>
      <DashboardTabs />
      <AttendanceDashboard />
    </>
  );
}