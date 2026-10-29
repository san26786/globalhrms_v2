"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";

import DynamicForm from "@/components/DynamicForm/DynamicForm";
import { bankDetailsFields } from "../bankDetailsFields";
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

export default function AddBankDetailsPage() {
  const router = useRouter();
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
    async function loadLookups() {
      try {
        const res = await fetch("/api/bank-details/lookup");
        const json = await res.json();
        if (json.success) {
          setBankNameOptions(json.bankNames || []);
          setBankAccTypeOptions(json.accountTypes || []);
        }
      } catch (err) {
        console.error("Failed to load lookups:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLookups();
  }, []);

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
      const res = await fetch("/api/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Successfully Added Bank Details");
        router.push("/bank-details");
      } else {
        toast.error("Failed to save bank details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving bank details.");
    }
  };

  const onSaveAndAdd = async (data: BankDetailsForm) => {
    try {
      const res = await fetch("/api/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Successfully Added Bank Details");
        form.reset({
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
        });
      } else {
        toast.error("Failed to save bank details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving bank details.");
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading dropdown options...</div>;
  }

  return (
    <>
      <DynamicForm
        form={form}
        title="Add Bank Account Details"
        mode="add"
        fields={fields}
        onSubmit={onSubmit}
        onSaveAndAdd={onSaveAndAdd}
        onCancel={() => router.push("/bank-details")}
      />

      {/* Employee Lookup Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-white dark:bg-[#111a2e] p-6 shadow-2xl border border-slate-100 dark:border-white/10 font-sans">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-white/10">
            <DialogTitle className="text-lg font-semibold text-[#1a1818] dark:text-[#f1f3f8] flex items-center gap-2">
              Select Employee
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-[#535768] dark:text-[#aab3c5]" />
            <Input
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 border-slate-200 dark:border-white/10 focus:border-[#e15425] focus:ring-[#e15425] rounded-xl bg-[#f6f7f9] dark:bg-[#0e1628] text-sm placeholder:text-[#676879] dark:placeholder:text-[#8b95ab] transition-all"
            />
          </div>

          {/* List area */}
          <div className="mt-4 max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/10 pr-1 select-none scrollbar-thin scrollbar-thumb-slate-200">
            {isEmployeesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#535768] dark:text-[#aab3c5] gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-[#0b5394] dark:text-[#8cb8f0]" />
                <span className="text-xs font-semibold text-[#535768] dark:text-[#aab3c5]">Searching employees...</span>
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
                      className="w-full text-left p-3 hover:bg-[#e3edf9] dark:hover:bg-[#16233d] active:bg-[#fbe6dd] dark:active:bg-[#da5427]/20 transition-all duration-150 flex items-center justify-between rounded-xl group border border-transparent hover:border-[#0b5394]/25 dark:hover:border-[#8cb8f0]/30"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#fbe6dd] dark:from-[#da5427]/15 to-[#e3edf9] dark:to-[#16233d] border border-[#0b5394]/20 dark:border-[#8cb8f0]/25 flex items-center justify-center font-semibold text-xs text-[#0b5394] dark:text-[#8cb8f0] shrink-0 group-hover:from-[#e15425] group-hover:to-[#c2431c] group-hover:text-white group-hover:border-[#c2431c] transition-all duration-200">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0] group-hover:text-[#7a2e12] dark:group-hover:text-[#f8d3c3] transition-colors">
                            {fullName}
                          </span>
                          <span className="text-[10px] text-[#535768] dark:text-[#aab3c5] mt-0.5 group-hover:text-[#535768] dark:group-hover:text-[#aab3c5] transition-colors font-semibold">
                            Emp ID: {emp.EMP_NBR}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] bg-[#f1f3f8] dark:bg-white/10 group-hover:bg-[#fbe6dd] dark:group-hover:bg-[#da5427]/15 text-[#535768] dark:text-[#aab3c5] group-hover:text-[#b4441f] dark:group-hover:text-[#f8a27e] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-colors shrink-0">
                        Select
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-[#535768] dark:text-[#aab3c5]">
                <p className="text-sm font-medium text-[#535768] dark:text-[#aab3c5]">No employees found</p>
                <p className="text-xs text-[#535768] dark:text-[#aab3c5] mt-1">Try searching with a different name or ID</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
