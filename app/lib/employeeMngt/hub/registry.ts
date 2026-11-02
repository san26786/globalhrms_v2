import { NotFoundError } from '@/lib/http/errors';
import { hubService, type HubConfig, type HubService } from './hubEngine';
import { isHubScreen, type HubScreenKey } from './hubTypes';
import { bankDtlConfig } from './screens/bank_dtl';
import { dependentDtlConfig } from './screens/dependent_dtl';
import { empContactAddressConfig } from './screens/empContactAddress';
import { emergencyContactDtlConfig } from './screens/emergency_contact_dtl';
import { empEducationConfig } from './screens/emp_education';
import { empLicenceConfig } from './screens/empLicence';
import { empWorkExpConfig } from './screens/empWorkExp';
import { empEmailConfig } from './screens/emp_email';
import { empInvestmentsConfig } from './screens/emp_investments';
import { empLanguageConfig } from './screens/emp_language';
import { empNationalityConfig } from './screens/emp_nationality';
import { empPhoneConfig } from './screens/emp_phone';
import { immigrationDtlConfig } from './screens/immigration_dtl';
import { membershipConfig } from './screens/membership';

/** Server configs of the Employee Hub record screens. */
const CONFIGS: Record<HubScreenKey, HubConfig> = {
  bank_dtl: bankDtlConfig,
  dependent_dtl: dependentDtlConfig,
  empContactAddress: empContactAddressConfig,
  emergency_contact_dtl: emergencyContactDtlConfig,
  emp_education: empEducationConfig,
  empLicence: empLicenceConfig,
  empWorkExp: empWorkExpConfig,
  emp_email: empEmailConfig,
  emp_investments: empInvestmentsConfig,
  emp_language: empLanguageConfig,
  emp_nationality: empNationalityConfig,
  emp_phone: empPhoneConfig,
  immigration_dtl: immigrationDtlConfig,
  membership: membershipConfig,
};

const services = new Map<HubScreenKey, HubService>();

/** The service behind /api/employeeMngt/[screen]; unknown screens are 404. */
export function hubFor(screen: string): HubService {
  if (!isHubScreen(screen)) throw new NotFoundError();
  let service = services.get(screen);
  if (!service) {
    service = hubService(CONFIGS[screen]);
    services.set(screen, service);
  }
  return service;
}
