import { bankDtlDefs } from './defs/bank_dtl';
import { dependentDtlDefs } from './defs/dependent_dtl';
import { empContactAddressDefs } from './defs/empContactAddress';
import { emergencyContactDtlDefs } from './defs/emergency_contact_dtl';
import { empEducationDefs } from './defs/emp_education';
import { empLicenceDefs } from './defs/empLicence';
import { empWorkExpDefs } from './defs/empWorkExp';
import { empEmailDefs } from './defs/emp_email';
import { empInvestmentsDefs } from './defs/emp_investments';
import { empLanguageDefs } from './defs/emp_language';
import { empNationalityDefs } from './defs/emp_nationality';
import { empPhoneDefs } from './defs/emp_phone';
import { immigrationDtlDefs } from './defs/immigration_dtl';
import { membershipDefs } from './defs/membership';
import type { HubScreenDefs } from './hubFields';
import type { HubScreenKey } from './hubTypes';

/** Form and list definitions of every Employee Hub record screen (client-safe). */
export const HUB_DEFS: Record<HubScreenKey, HubScreenDefs> = {
  bank_dtl: bankDtlDefs,
  dependent_dtl: dependentDtlDefs,
  empContactAddress: empContactAddressDefs,
  emergency_contact_dtl: emergencyContactDtlDefs,
  emp_education: empEducationDefs,
  empLicence: empLicenceDefs,
  empWorkExp: empWorkExpDefs,
  emp_email: empEmailDefs,
  emp_investments: empInvestmentsDefs,
  emp_language: empLanguageDefs,
  emp_nationality: empNationalityDefs,
  emp_phone: empPhoneDefs,
  immigration_dtl: immigrationDtlDefs,
  membership: membershipDefs,
};
