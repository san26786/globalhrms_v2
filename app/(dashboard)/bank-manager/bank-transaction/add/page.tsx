"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Save, ChevronRight, Database, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface BankAccountOption {
  label: string;
  value: string;
}

const categoryTypes = [
  { label: "Revenue / Income", value: "Revenue / Income" },
  { label: "Operating Expense", value: "Operating Expense" },
  { label: "Payroll / Salary", value: "Payroll / Salary" },
  { label: "Tax Payment", value: "Tax Payment" },
  { label: "Investment", value: "Investment" },
  { label: "Transfer", value: "Transfer" },
];

const categoryOptionsMap: Record<string, { label: string; value: string }[]> = {
  "Revenue / Income": [
    { label: "Customer Receipts / Sales", value: "Customer Receipts / Sales" },
    { label: "Interest Income", value: "Interest Income" },
    { label: "Other Income", value: "Other Income" },
  ],
  "Operating Expense": [
    { label: "Office Supplies", value: "Office Supplies" },
    { label: "Rent & Utilities", value: "Rent & Utilities" },
    { label: "Travel & Entertainment", value: "Travel & Entertainment" },
    { label: "Software & Subscriptions", value: "Software & Subscriptions" },
    { label: "Professional Services", value: "Professional Services" },
  ],
  "Payroll / Salary": [
    { label: "Employee Wages", value: "Employee Wages" },
    { label: "Contractor Payments", value: "Contractor Payments" },
    { label: "Employee Benefits", value: "Employee Benefits" },
  ],
  "Tax Payment": [
    { label: "Income Tax", value: "Income Tax" },
    { label: "GST / VAT", value: "GST / VAT" },
    { label: "Payroll Tax", value: "Payroll Tax" },
  ],
  "Investment": [
    { label: "Capital Expense", value: "Capital Expense" },
    { label: "Stock Purchase", value: "Stock Purchase" },
  ],
  "Transfer": [
    { label: "Inter-account Transfer", value: "Inter-account Transfer" },
    { label: "Owner Drawings", value: "Owner Drawings" },
  ],
};

export default function AddTransactionPage() {
  const router = useRouter();
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitType, setSubmitType] = useState<"save" | "saveAndAdd">("save");

  // Form State
  const [accountId, setAccountId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [transactionType, setTransactionType] = useState<string>("BTTI");
  const [categoryType, setCategoryType] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("0");
  const [description, setDescription] = useState<string>("");

  // Advanced Form State
  const [particulars, setParticulars] = useState<string>("");
  const [chqnoRefno, setChqnoRefno] = useState<string>("");
  const [closingBal, setClosingBal] = useState<string>("0");
  const [sol, setSol] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        const resLookup = await fetch("/api/bank-transaction/lookup");
        const jsonLookup = await resLookup.json();
        if (jsonLookup.success) {
          setBankAccounts(lookupJson => jsonLookup.bankAccounts || []);
        }

        const resDetails = await fetch("/api/bank-details");
        const jsonDetails = await resDetails.json();
        if (jsonDetails.data) {
          setBankDetails(jsonDetails.data);
        }
      } catch (err) {
        console.error("Failed to load lookups:", err);
        toast.error("Failed to load bank details");
      } finally {
        setLoadingLookups(false);
      }
    }
    loadData();
  }, []);

  // Auto-resolve Bank Name based on Account selected
  const bankName = useMemo(() => {
    const selectedBank = bankDetails.find((b) => String(b.BANK_ID) === accountId);
    return selectedBank ? selectedBank.BANK_NAME || "" : "";
  }, [accountId, bankDetails]);

  // Reset category selection when category type changes
  const handleCategoryTypeChange = (val: string) => {
    setCategoryType(val);
    setCategory("");
  };

  // Filter categories based on category type
  const availableCategories = useMemo(() => {
    return categoryType ? categoryOptionsMap[categoryType] || [] : [];
  }, [categoryType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Please select a bank account");
      return;
    }
    if (!categoryType) {
      toast.error("Please select a category type");
      return;
    }

    setSaving(true);
    try {
      const isCredit = transactionType === "BTTI";
      const payload = {
        account_id: parseInt(accountId),
        transaction_date: transactionDate,
        accounting_transaction_type: transactionType,
        category_type: categoryType,
        category,
        debit_amount: isCredit ? "0" : amount,
        credit_amount: isCredit ? amount : "0",
        particulars: particulars || category || "Manual Transaction",
        description,
        chqno_refno: chqnoRefno,
        closing_bal: closingBal,
        sol: parseInt(sol) || 0,
        notes,
      };

      const res = await fetch("/api/bank-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Bank transaction created successfully");
        if (submitType === "saveAndAdd") {
          // Reset form states for another entry
          setCategoryType("");
          setCategory("");
          setAmount("0");
          setDescription("");
          setParticulars("");
          setChqnoRefno("");
          setClosingBal("0");
          setSol("0");
          setNotes("");
          toast.info("Form cleared for adding another transaction");
        } else {
          router.push("/bank-transaction");
        }
      } else {
        toast.error(json.message || "Failed to create transaction");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving bank transaction");
    } finally {
      setSaving(false);
    }
  };

  if (loadingLookups) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#535768] dark:text-[#aab3c5] space-y-2">
        <Loader2 className="animate-spin text-[#0b5394] dark:text-[#8cb8f0]" size={24} />
        <span>Loading form configurations...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Card (Matches BreadcrumbHeader Design) */}
      <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span>Bank Transaction</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">Add</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-[#0b5394] dark:text-[#8cb8f0] h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8] animate-in fade-in slide-in-from-left-2 duration-200">
                New Bank Transaction
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="submit"
              form="transaction-form"
              disabled={saving}
              onClick={() => setSubmitType("save")}
              size="icon"
              className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:shadow-[#e15425]/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save"
            >
              {saving && submitType === "save" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Save & Add (+) Button */}
            <Button
              type="submit"
              form="transaction-form"
              disabled={saving}
              onClick={() => setSubmitType("saveAndAdd")}
              size="icon"
              className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20 hover:shadow-emerald-700/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save and Add"
            >
              {saving && submitType === "saveAndAdd" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Link href="/bank-transaction">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-rose-200 dark:border-rose-400/30 hover:border-rose-300 dark:hover:border-rose-400/50 bg-white dark:bg-[#111a2e] hover:bg-rose-50 dark:hover:bg-rose-400/10 text-rose-700 dark:text-rose-300 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Card className="rounded-3xl border shadow-sm bg-white dark:bg-[#111a2e] overflow-hidden text-left">
        <form id="transaction-form" onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            {/* Account */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Account
                  <span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank Name */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Bank Name</label>
              </div>
              <div className="w-3/4">
                <Input
                  type="text"
                  disabled
                  value={bankName}
                  placeholder="Select an option"
                  className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-[#f6f7f9] dark:bg-[#0e1628] text-[#535768] dark:text-[#aab3c5] font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            {/* Accounting Transaction Type */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Accounting Transaction Type
                  <span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                    <SelectItem value="BTTI" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">Incoming / Receipt (Credit)</SelectItem>
                    <SelectItem value="BTTO" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">Outgoing / Payment (Debit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category Type */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Category Type
                  <span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={categoryType} onValueChange={handleCategoryTypeChange}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                    {categoryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Category</label>
              </div>
              <div className="w-3/4">
                <Select value={category} onValueChange={setCategory} disabled={!categoryType}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="flex gap-2 items-start pt-1">
              <div className="w-1/4 text-end pt-1.5">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Description</label>
              </div>
              <div className="w-3/4">
                <Textarea
                  placeholder="Add description details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-1/2 min-h-[80px] rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                />
              </div>
            </div>

            {/* Transaction Date */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Transaction Date
                  <span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                />
              </div>
            </div>

            {/* Transaction Amount */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Transaction Amount
                  <span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                />
              </div>
            </div>

            {/* Show Advanced Options Toggle */}
            <div className="flex gap-2 items-center pt-2">
              <div className="w-1/4"></div>
              <div className="w-3/4">
                <Button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="h-10 px-5 rounded-xl border border-[#0b5394]/25 dark:border-[#8cb8f0]/30 text-[#0b5394] dark:text-[#8cb8f0] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] font-semibold gap-1.5 transition-all duration-200 bg-white dark:bg-[#111a2e] cursor-pointer"
                >
                  {showAdvanced ? (
                    <>
                      Hide Advanced Options
                      <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Show Advanced Options
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Advanced Options Section */}
            {showAdvanced && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Particulars */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Particulars</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="text"
                      placeholder="e.g. Transaction Details"
                      value={particulars}
                      onChange={(e) => setParticulars(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                    />
                  </div>
                </div>

                {/* Cheque / Ref No */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Cheque / Ref No</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="text"
                      placeholder="e.g. CHQ-92834"
                      value={chqnoRefno}
                      onChange={(e) => setChqnoRefno(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                    />
                  </div>
                </div>

                {/* Closing Balance */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Closing Balance</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="number"
                      step="0.01"
                      value={closingBal}
                      onChange={(e) => setClosingBal(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                    />
                  </div>
                </div>

                {/* SOL */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">SOL</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="number"
                      value={sol}
                      onChange={(e) => setSol(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="flex gap-2 items-start pt-1">
                  <div className="w-1/4 text-end pt-1.5">
                    <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Notes</label>
                  </div>
                  <div className="w-3/4">
                    <Textarea
                      placeholder="Internal audit notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-1/2 min-h-[80px] rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-[#f6f7f9] dark:bg-[#0e1628] border-t border-slate-100 dark:border-white/10 p-6 flex justify-start gap-3">
            <Button
              type="submit"
              onClick={() => setSubmitType("save")}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[#e15425] hover:bg-[#c2431c] text-white font-semibold gap-1.5 shadow-md shadow-[#e15425]/25 dark:shadow-black/30 border-0 cursor-pointer"
            >
              {saving && submitType === "save" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            
            <Button
              type="submit"
              onClick={() => setSubmitType("saveAndAdd")}
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5 shadow-md shadow-emerald-700/20 border-0 cursor-pointer"
            >
              {saving && submitType === "saveAndAdd" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save And Add"
              )}
            </Button>

            <Link href="/bank-transaction">
              <Button type="button" variant="outline" className="h-10 px-5 rounded-xl border-slate-200 dark:border-white/10 hover:bg-[#f1f3f8] dark:hover:bg-white/5 font-semibold text-[#323338] dark:text-[#d5dae4] bg-white dark:bg-[#111a2e] cursor-pointer">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
