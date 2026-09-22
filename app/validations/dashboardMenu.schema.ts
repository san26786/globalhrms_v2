/**
 * app/validations/dashboardMenu.schema.ts
 *
 * Mirrors Dashboard_menu::setFormValidationRules() exactly:
 *   - menu_name, menu_url, sequence: required in both create and edit
 *   - menu_code: required only in create mode ($this->actionMode == 0)
 * CI ran `trim|required` only — no format/uniqueness checks were enforced
 * (the unused `checkIfMSTRCDExists` method was never wired into this flow),
 * so none are added here either.
 */
import { z } from 'zod';

export const createDashboardMenuSchema = z.object({
  parentModuleId: z.coerce.number().int().positive().nullable().optional(),
  menuCode: z.string().trim().min(1, 'Menu Code is required'),
  menuName: z.string().trim().min(1, 'Menu Name is required'),
  menuUrl: z.string().trim().min(1, 'Menu Url is required'),
  sequence: z.coerce.number().int('Sequence is required'),
});
export type CreateDashboardMenuInput = z.infer<typeof createDashboardMenuSchema>;

export const updateDashboardMenuSchema = z.object({
  menuName: z.string().trim().min(1, 'Menu Name is required'),
  menuUrl: z.string().trim().min(1, 'Menu Url is required'),
  sequence: z.coerce.number().int('Sequence is required'),
});
export type UpdateDashboardMenuInput = z.infer<typeof updateDashboardMenuSchema>;
