import { FormField } from "../../common/common_type/commonTypeFields";

export function bankDetailsFields(
  bankNameOptions: { label: string; value: string | number }[] = [],
  bankAccTypeOptions: { label: string; value: string | number }[] = []
): FormField[] {
  return [
    {
      type: "select",
      name: "bank_acc_type",
      label: "Bank Account Type",
      options: bankAccTypeOptions,
      required: true,
    },
    {
      type: "select",
      name: "bankname",
      label: "Bank Name",
      options: bankNameOptions,
      required: true,
    },
    {
      type: "input",
      name: "branchname",
      label: "Branch Name",
      required: true,
    },
    {
      type: "input",
      name: "accountname",
      label: "Account Name",
      required: true,
    },
    {
      type: "input",
      name: "accountno",
      label: "Account No",
      required: true,
      placeholder: "Enter account number",
    },
    {
      type: "input",
      name: "branchcode",
      label: "Branch Code",
    },
    {
      type: "input",
      name: "ifsccode",
      label: "IFSC Code",
    },
    {
      type: "input",
      name: "micrcode",
      label: "MICR Code",
    },
    {
      type: "textarea",
      name: "address",
      label: "Address",
    },
    {
      type: "input",
      name: "opening_bal",
      label: "Opening Balance",
      placeholder: "0",
    },
    {
      type: "input",
      name: "deposits",
      label: "Deposits",
      placeholder: "0",
    },
    {
      type: "input",
      name: "withdrawals",
      label: "Withdrawals",
      placeholder: "0",
    },
  ];
}
