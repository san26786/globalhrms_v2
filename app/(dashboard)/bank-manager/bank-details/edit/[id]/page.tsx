"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";

import DynamicForm from "@/components/DynamicForm/DynamicForm";
import { bankDetailsFields } from "../../bankDetailsFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BankDetailsForm {
  bank_acc_type: string;
  bankname: string;
  branchname: string;
  accountname: string;
  accountno: string;
  branchcode: string;
  ifsccode: string;
  micrcode: string;
  address: string;
  opening_bal: string;
  deposits: string;
  withdrawals: string;
}

export default function EditBankDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [bankNameOptions, setBankNameOptions] = useState<{ label: string; value: string | number }[]>([]);
  const [bankAccTypeOptions, setBankAccTypeOptions] = useState<{ label: string; value: string | number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Employee Lookup Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);

  const form = useForm<BankDetailsForm>({
    defaultValues: {
      bank_acc_type: "",
      bankname: "",
      branchname: "",
      accountname: "",
      accountno: "",
      branchcode: "",
      ifsccode: "",
      micrcode: "",
      address: "",
      opening_bal: "0",
      deposits: "0",
      withdrawals: "0",
    },
  });

  const [columnSettings] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bank_details_column_settings");
      if (stored) return JSON.parse(stored);
    }
    return [];
  });

  useEffect(() => {
    async function loadData() {
      try {
        // Load lookups
        const lookupRes = await fetch("/api/bank-details/lookup");
        const lookupJson = await lookupRes.json();
        if (lookupJson.success) {
          setBankNameOptions(lookupJson.bankNames || []);
          setBankAccTypeOptions(lookupJson.accountTypes || []);
        }

        // Load existing bank details
        const res = await fetch(`/api/bank-details/${id}`);
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const resetData = {
            bank_acc_type: String(d.BANK_ACC_TYPE),
            bankname: String(d.BANK_NAME),
            branchname: d.BRANCH_NM || "",
            accountname: d.ACCOUNT_NM || "",
            accountno: d.ACCOUNT_NO || "",
            branchcode: d.BRANCH_CD || "",
            ifsccode: d.IFSC_CD || "",
            micrcode: d.MICR_CD || "",
            address: d.ADDRESS || "",
            opening_bal: String(d.OPENING_BAL || "0"),
            deposits: String(d.DEPOSITS || "0"),
            withdrawals: String(d.WITHDRAWALS || "0"),
          };
          form.reset(resetData);
        } else {
          toast.error("Failed to load bank detail data.");
        }
      } catch (err) {
        console.error("Failed to load edit data:", err);
        toast.error("Error loading bank detail data.");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id, form]);

  // Fetch employees for lookup
  useEffect(() => {
    if (!isEmployeeModalOpen) return;

    const delayDebounceFn = setTimeout(() => {
      fetchEmployees();
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isEmployeeModalOpen]);

  const fetchEmployees = async () => {
    setIsEmployeesLoading(true);
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  const handleSelectEmployee = (emp: any) => {
    const fullName = [emp.EMP_NAME, emp.EMPLST_NM].filter(Boolean).join(" ");
    form.setValue("accountname", fullName);
    setIsEmployeeModalOpen(false);
  };

  const fields = useMemo(() => {
    const baseFields = bankDetailsFields(bankNameOptions, bankAccTypeOptions);
    
    const nameMap: Record<string, string> = {
      bank_acc_type: "BANK_ACC_TYPE",
      bankname: "BANK_NAME",
      branchname: "BRANCH_NM",
      accountname: "ACCOUNT_NM",
      accountno: "ACCOUNT_NO",
      ifsccode: "IFSC_CD",
      address: "ADDRESS",
      opening_bal: "OPENING_BAL",
      deposits: "DEPOSITS",
      withdrawals: "WITHDRAWALS",
    };

    const finalFields = baseFields
      .map((field) => {
        const sysName = nameMap[field.name];
        if (!sysName) return field;

        const setting = columnSettings.find((s) => s.systemName === sysName);
        if (!setting) return field;

        return {
          ...field,
          label: setting.displayName,
          visible: setting.visibleInForm,
        };
      })
      .filter((field: any) => field.visible !== false);

    // Inject lookup callback
    const accountNameField = finalFields.find((f) => f.name === "accountname");
    if (accountNameField) {
      accountNameField.hasLookup = true;
      accountNameField.onLookupClick = () => setIsEmployeeModalOpen(true);
    }

    return finalFields;
  }, [bankNameOptions, bankAccTypeOptions, columnSettings]);

  const onSubmit = async (data: BankDetailsForm) => {
    try {
      const res = await fetch(`/api/bank-details/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Successfully Updated Bank Details");
        router.push("/bank-manager/bank-details");
      } else {
        toast.error("Failed to update bank details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating bank details.");
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading bank details...</div>;
  }

  return (
    <>
      <DynamicForm
        form={form}
        title="Edit Bank Account Details"
        mode="edit"
        fields={fields}
        onSubmit={onSubmit}
        onCancel={() => router.push("/bank-manager/bank-details")}
      />

      {/* Employee Lookup Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 font-sans">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Select Employee
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <Input
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl bg-slate-50/50 text-sm placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* List area */}
          <div className="mt-4 max-h-[300px] overflow-y-auto divide-y divide-slate-50 pr-1 select-none scrollbar-thin scrollbar-thumb-slate-200">
            {isEmployeesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                <span className="text-xs font-semibold text-slate-500">Searching employees...</span>
              </div>
            ) : employees.length > 0 ? (
              <div className="space-y-1.5 py-1">
                {employees.map((emp) => {
                  const fullName = [emp.EMP_NAME, emp.EMPLST_NM].filter(Boolean).join(" ");
                  const initials = [emp.EMP_NAME, emp.EMPLST_NM]
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "E";
                  
                  return (
                    <button
                      key={emp.EMP_ID}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full text-left p-3 hover:bg-blue-50/50 active:bg-blue-100/70 transition-all duration-150 flex items-center justify-between rounded-xl group border border-transparent hover:border-blue-100"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100/50 flex items-center justify-center font-bold text-xs text-blue-600 shrink-0 group-hover:from-blue-600 group-hover:to-blue-700 group-hover:text-white group-hover:border-blue-700 transition-all duration-200">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 group-hover:text-blue-900 transition-colors">
                            {fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-500 transition-colors font-semibold">
                            Emp ID: {emp.EMP_NBR}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider transition-colors shrink-0">
                        Select
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <p className="text-sm font-medium text-slate-500">No employees found</p>
                <p className="text-xs text-slate-400 mt-1">Try searching with a different name or ID</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
