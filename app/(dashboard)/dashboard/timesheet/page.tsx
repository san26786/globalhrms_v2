import DashboardTabs from "@/components/layout/DashboardTabs";
import TimesheetDashboard from "@/components/dashboard/TimesheetDashboard";

export default function TimesheetPage() {
  return (
    <>
      <DashboardTabs />
      <TimesheetDashboard />
    </>
  );
}