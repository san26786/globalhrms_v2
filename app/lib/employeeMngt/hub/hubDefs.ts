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
import { jobMstDefs, jobProbationDefs } from './defs/job_mst';
import { empReportingDefs } from './defs/emp_reporting';
import { empReportingLocationsDefs } from './defs/empReportingLocations';
import { empWorkShiftDefs } from './defs/emp_work_shift';
import { empPictureDefs } from './defs/empPicture';
import { memberDocumentsDefs } from './defs/member_documents';
import { membershipDefs } from './defs/membership';
import { terminationDefs } from './defs/termination';
import { exitClearanceDefs, exitStepDefs } from './defs/exit_clearance';
import { outdoorAllowanceDefs } from './defs/outdoor_allowance';
import { payrollSummaryDefs } from './defs/payroll_summary';
import { advanceSalaryDefs } from './defs/advance_salary';
import { incentiveDefs } from './defs/incentive';
import { empHrprocessDefs } from './defs/emp_hrprocess';
import { annexureProcessingDefs, myAnnexuresDefs } from './defs/annexures';
import { myPayslipsDefs, payrollProcessingDefs } from './defs/payslips';
import { salaryBreakupDefs } from './defs/salary_breakup';
import { salaryComponentsDefs } from './defs/salary_components';
import { salaryReportDefs } from './defs/salary_report';
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
  job_mst: jobMstDefs,
  job_probation: jobProbationDefs,
  emp_reporting: empReportingDefs,
  emp_work_shift: empWorkShiftDefs,
  empReportingLocations: empReportingLocationsDefs,
  empPicture: empPictureDefs,
  member_documents: memberDocumentsDefs,
  termination: terminationDefs,
  exit_clearance: exitClearanceDefs,
  ...exitStepDefs,
  outdoor_allowance: outdoorAllowanceDefs,
  payroll_summary: payrollSummaryDefs,
  advance_salary: advanceSalaryDefs,
  incentive: incentiveDefs,
  emp_hrprocess: empHrprocessDefs,
  annexure_processing: annexureProcessingDefs,
  my_annexures: myAnnexuresDefs,
  payroll_processing: payrollProcessingDefs,
  my_payslips: myPayslipsDefs,
  salary_report: salaryReportDefs,
  salary_components: salaryComponentsDefs,
  salary_breakup: salaryBreakupDefs,
};
