import type { PunchService, PunchStatus, PunchResult } from '../../domain/attendance/PunchService';

/**
 * STUB implementation. The real employee_records table/columns used by
 * get_punch_status_of_day() and the two quick-punch controller actions
 * were not part of the shared source — port this once employee_records
 * model/table is shared, same as the SettingAttributeRepository pattern
 * used for setting_group_attribute_mst_m.
 */
export class PunchApplicationService implements PunchService {
  async getTodayStatus(_userId: number): Promise<PunchStatus | null> {
    throw new Error('PunchApplicationService.getTodayStatus: not yet wired to employee_records');
  }

  async punchIn(_userId: number): Promise<PunchResult> {
    throw new Error('PunchApplicationService.punchIn: not yet wired to employee_records');
  }

  async punchOut(_userId: number): Promise<PunchResult> {
    throw new Error('PunchApplicationService.punchOut: not yet wired to employee_records');
  }
}
