export type PunchStatus = 'in' | 'out';

export interface PunchResult {
  status: PunchStatus;
}

/**
 * Ported from:
 *  - get_punch_status_of_day() helper (read)
 *  - attndMngt/employee_records/employee_records_insert_quick_punchin  (write: in)
 *  - attndMngt/employee_records/employee_records_update_quick_punchout (write: out)
 *
 * The source computed the button's target action by first reading today's
 * status, then choosing the *opposite* action's URL. Modeled here as two
 * explicit methods instead of one toggle() so each maps 1:1 to a source
 * controller action and stays independently testable.
 */
export interface PunchService {
  getTodayStatus(userId: number): Promise<PunchStatus | null>;
  punchIn(userId: number): Promise<PunchResult>;
  punchOut(userId: number): Promise<PunchResult>;
}
