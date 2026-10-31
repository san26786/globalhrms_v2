"use client";

import ResourceFormPage from "@/components/resource/ResourceFormPage";
import type { DynamicField } from "@/lib/form-builder/formTypes";
import { EMP_SCREENS, USER_READ_ONLY, type EmpFormModel, type EmpScreen, type EmpValues } from "@/lib/employeeMngt/empTypes";
import { useInit } from "../../../systmMngt/_shared/useInit";

/**
 * CI employeeMngt/emp_mst initForm — the employee's "Personal" tab (add / edit). As CI: Caste and Race
 * for India brands only; the driving licence expiry appears once a licence number is entered (not
 * "NA"); Employee Status is fixed on edit; a normal user sees codes, names, e-mail, phone, birth date,
 * manager and the director / PSC flags read-only. Fields follow emp_manager_new_vw's Form Settings.
 * Rules: lib/employeeMngt/empMst.
 */
const API = "/api/employeeMngt/emp_mst";

const EMPTY: EmpValues = {
  EMP_NBR: "", title: "", EMP_NAME: "", cntctMddlNm: "", cntctLstNm: "", known_as: "", EMP_INITIALS: "", email: "", COUNTRY_CODE: "",
  phone: "", dob: "", cntctSmoker: false, EmployementStatus: "", cntctGenderId: "", marritalStatusId: "", marriage_date: "",
  maiden_name: "", castId: "", raseId: "", ethinicity: "", bloodgrp: "", isManager: false, managerId: "", hrExecutiveId: "",
  taxAllowType: "", ext_ref_emp_no: "", tax_ref_no: "", IS_DISABLE: false, ni_table: "", EMP_SSN_NBR: "", EMP_SIN_NBR: "",
  EMP_PAN_NBR: "", EMP_SKYPE_ID: "", EMP_DRI_LICE_NBR: "", EMP_DRI_LICE_EXP_DATE: "", careerStream: "", EMP_MILITARY_SERVICE: false,
  IS_DIRECTOR: false, IS_BUSINESS_OWNER: false, IS_PSC: false, IS_SHAREHOLDER: false,
};

const NO_LICENCE = ["na", "n/a", "not available"];
const opts = (list: Array<{ value: number; label: string }>) => list.map((o) => ({ value: String(o.value), label: o.label }));

export default function EmployeeForm({ mode, screen, id }: { mode: "add" | "edit"; screen: EmpScreen; id?: string }) {
  const { data, error } = useInit<EmpFormModel>(`${API}/form`);
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const { options: o, restricted } = data;
  const locked = new Set<string>(restricted && mode === "edit" ? USER_READ_ONLY : []);
  const config = EMP_SCREENS[screen];

  const useFields = (v: EmpValues): DynamicField[] => {
    const f = (name: keyof EmpValues, label: string, type: string, extra: Partial<DynamicField> = {}): DynamicField => ({
      name, label, type, disabled: locked.has(name), ...extra,
    });
    const select = (name: keyof EmpValues, label: string, list: Array<{ value: number; label: string }>, extra: Partial<DynamicField> = {}) =>
      f(name, label, "select", { options: opts(list), ...extra });
    const licence = v.EMP_DRI_LICE_NBR.trim().toLowerCase();
    return [
      f("EMP_NBR", "Employee Code", "text", { required: true, attribute: "EMP_NBR" }),
      select("title", "Title", o.titles, { required: true, attribute: "TITLE" }),
      f("EMP_NAME", "First Name", "text", { required: true, attribute: "EMP_NAME" }),
      f("cntctMddlNm", "Middle Name", "text", { attribute: "EMP_MIDDLE_NM" }),
      f("cntctLstNm", "Last Name", "text", { required: true, attribute: "EMPLST_NM" }),
      f("known_as", "Known As", "text", { attribute: "KNOWN_AS" }),
      f("EMP_INITIALS", "Employee Initials", "text", { required: true, attribute: "EMP_INITIALS" }),
      f("email", "Email Address", "email", { required: true, attribute: "EMAIL_ADD" }),
      select("COUNTRY_CODE", "Country Code", o.countryCodes, { attribute: "FULL_PHONE_NBR" }),
      f("phone", "Phone Number", "text", { required: true, attribute: "PHONE_NBR" }),
      f("dob", "Date Of Birth", "date", { required: true, attribute: "DOB" }),
      f("cntctSmoker", "Is Smoker", "checkbox", { attribute: "IS_SMOKER" }),
      select("EmployementStatus", "Employee Status", o.statuses, { disabled: mode === "edit", attribute: "EMP_STATUS" }),
      select("cntctGenderId", "Gender", o.genders, { attribute: "GENDER" }),
      select("marritalStatusId", "Marital Status", o.maritalStatuses, { attribute: "MARITAL_STATUS" }),
      f("marriage_date", "Marriage Date", "date", { attribute: "MARRIAGE_DATE" }),
      f("maiden_name", "Maiden Name", "text", { attribute: "MAIDEN_NAME" }),
      select("castId", "Caste", o.castes, { hidden: !data.showCasteRace, attribute: "CAST" }),
      select("raseId", "Race", o.races, { hidden: !data.showCasteRace, attribute: "RAISE" }),
      select("ethinicity", "Ethnicity", o.ethnicities, { attribute: "ETHINICITY" }),
      select("bloodgrp", "Blood Group", o.bloodGroups, { attribute: "BLOOD_GRP_NM" }),
      f("isManager", "Is Manager", "checkbox", { attribute: "IS_MANAGER" }),
      select("managerId", "Manager", o.managers, { attribute: "MANAGER" }),
      select("hrExecutiveId", "HR Executive", o.hrExecutives, { attribute: "HR_EXECUTIVE_ID" }),
      select("taxAllowType", "Tax Allowance Type", o.taxAllowanceTypes, { attribute: "TAX_ALLOWANCE_TYPE_NM" }),
      f("ext_ref_emp_no", "External Ref Emp No", "text", { attribute: "EXT_REF_EMP_NO" }),
      f("tax_ref_no", "Tax Ref No", "text", { attribute: "TAX_REF_NO" }),
      f("IS_DISABLE", "Is Disable", "checkbox"),
      f("ni_table", "NI Table", "text", { attribute: "NI_TABLE" }),
      f("EMP_SSN_NBR", "SSN Number", "text", { attribute: "EMP_SSN_NBR" }),
      f("EMP_SIN_NBR", "Aadhar No", "text", { attribute: "EMP_SIN_NBR" }),
      f("EMP_PAN_NBR", "PAN Number", "text", { attribute: "EMP_PAN_NBR" }),
      f("EMP_SKYPE_ID", "Skype ID", "text", { attribute: "SKYPE_ID" }),
      f("EMP_DRI_LICE_NBR", "Driving License Number", "text", { attribute: "EMP_DRI_LICE_NBR" }),
      f("EMP_DRI_LICE_EXP_DATE", "Driving License Expiry Date", "date", {
        hidden: !licence || NO_LICENCE.includes(licence),
        attribute: "EMP_DRI_LICE_EXP_DATE",
      }),
      select("careerStream", "Career Stream", o.careerStreams, { attribute: "CAREERSTREAM_NM" }),
      f("EMP_MILITARY_SERVICE", "Military Service", "checkbox", { attribute: "EMP_MILITARY_SERVICE" }),
      f("IS_DIRECTOR", "Is Director", "checkbox", { attribute: "IS_DIRECTOR" }),
      f("IS_BUSINESS_OWNER", "Is Business Owner", "checkbox", { attribute: "IS_BUSINESS_OWNER" }),
      f("IS_PSC", "Is PSC", "checkbox", { attribute: "IS_PSC" }),
      f("IS_SHAREHOLDER", "Is Shareholder", "checkbox", { attribute: "IS_SHAREHOLDER" }),
    ];
  };

  return (
    <ResourceFormPage<EmpValues>
      title={mode === "add" ? "Add Employee Manager" : "Edit Employee Manager"}
      breadcrumb={["Employee Hub", config.title]}
      mode={mode}
      id={id}
      apiPath={API}
      basePath={config.base}
      objectName="emp_manager_new_vw"
      allowSaveAndAdd={false}
      useFields={useFields}
      defaultValues={EMPTY}
    />
  );
}
