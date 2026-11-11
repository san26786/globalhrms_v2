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
import { jobMstConfig, jobProbationConfig } from './screens/job_mst';
import { empReportingConfig } from './screens/emp_reporting';
import { empReportingLocationsConfig } from './screens/empReportingLocations';
import { empWorkShiftConfig } from './screens/emp_work_shift';
import { empPictureConfig } from './screens/empPicture';
import { memberDocumentsConfig } from './screens/member_documents';
import { membershipConfig } from './screens/membership';
import { terminationConfig } from './screens/termination';
import { exitClearanceConfig, exitStepConfigs } from './screens/exit_clearance';
import { outdoorAllowanceConfig } from './screens/outdoor_allowance';
import { payrollSummaryConfig } from './screens/payroll_summary';
import { advanceSalaryConfig } from './screens/advance_salary';
import { incentiveConfig } from './screens/incentive';
import { empHrprocessConfig } from './screens/emp_hrprocess';
import { annexureProcessingConfig, myAnnexuresConfig } from './screens/annexures';

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
  job_mst: jobMstConfig,
  job_probation: jobProbationConfig,
  emp_reporting: empReportingConfig,
  emp_work_shift: empWorkShiftConfig,
  empReportingLocations: empReportingLocationsConfig,
  empPicture: empPictureConfig,
  member_documents: memberDocumentsConfig,
  termination: terminationConfig,
  exit_clearance: exitClearanceConfig,
  ...exitStepConfigs,
  outdoor_allowance: outdoorAllowanceConfig,
  payroll_summary: payrollSummaryConfig,
  advance_salary: advanceSalaryConfig,
  incentive: incentiveConfig,
  emp_hrprocess: empHrprocessConfig,
  annexure_processing: annexureProcessingConfig,
  my_annexures: myAnnexuresConfig,
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
