/**
 * NOT PORTED. CI calls punch_monitor_m->syncAll($oaBrandId, 1, 0, date('Y-m-d'), 0, $attndEmpId)
 * after every punch to refresh the punch_monitor summary table (worked hours, attendance).
 * punch_monitor_m.php has not been shared, so this is a deliberate no-op. Until it is ported,
 * punches made from the Next.js header will NOT update punch_monitor.
 */
export async function syncPunchMonitor(_params: { oaBrandId: number; attndEmpId: number; userDate: Date }): Promise<void> {
  // intentionally empty
}
