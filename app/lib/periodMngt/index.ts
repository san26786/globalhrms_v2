import type { RequestSubject } from '@/lib/auth/getSubject';
import { getMasterCode, getMasterId, masterNames } from '@/lib/masters/masterService';
import { menuPolicy } from '@/lib/resource/policies';
import { settingService } from '@/lib/settings/settingService';
import { resolveBrand } from '@/lib/utilities/access';
import { generatePeriods, PERIOD_TYPES } from '@/lib/utilities/periodGenerator';
import { PrismaPeriodRepository } from './period.repository';
import { PeriodService } from './period.service';
import type { PeriodAccess, PeriodActor, PeriodGeneratorPort, PeriodMasters, PeriodSettings } from './period.types';

/**
 * Composition root of periodMngt/period_mst: the only place that knows the concrete classes.
 * Routes import `periodService`; tests construct PeriodService with fakes.
 */

// CI's controller checked nothing on the server; the menu entry's permission_dtl FUNCTION grant
// decides here (menuPolicy matches by prefix, so "Leave Period Details" —
// periodMngt/period_mst/changeType/864 — grants it as well).
const policy = menuPolicy('periodMngt/period_mst');
const access: PeriodAccess = {
  can: (actor, action) => policy.check(actor as RequestSubject, action),
};

const masters: PeriodMasters = {
  id: (code) => getMasterId(code),
  code: (id) => getMasterCode(id),
  name: async (id) => (await masterNames([id])).get(id)?.name ?? null,
};

const settings: PeriodSettings = {
  value: (code, oaBrandId) => settingService.getValue(code, oaBrandId),
  valueOrDefault: (code, oaBrandId) => settingService.getValueOrDefault(code, oaBrandId),
};

const generator: PeriodGeneratorPort = {
  async generate(actor: PeriodActor, oaBrandId, onlyTypeCodes) {
    const subject = actor as RequestSubject;
    const brand = await resolveBrand(subject, oaBrandId);
    return generatePeriods(subject, brand, new Date(), { onlyTypeCodes });
  },
};

export const periodService = new PeriodService(
  new PrismaPeriodRepository(),
  masters,
  settings,
  generator,
  access,
  PERIOD_TYPES,
);

/** lib/listview/listDefinitions 'period_mst' scope (CI index($periodTypeId, $periodStatusId)). */
export const periodListScope = (subject: RequestSubject, query: Record<string, string>) =>
  periodService.listScope(subject, query);
