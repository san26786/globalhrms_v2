"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Save, ChevronRight, Database, X, ChevronDown, ChevronUp } from "lucide-react";
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

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form State
  const [accountId, setAccountId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>("");
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
  const [transactionStatus, setTransactionStatus] = useState<string>("1");

  useEffect(() => {
    async function loadData() {
      try {
        // Load bank accounts lookup
        const lookupRes = await fetch("/api/bank-transaction/lookup");
        const lookupJson = await lookupRes.json();
        if (lookupJson.success) {
          setBankAccounts(lookupJson.bankAccounts || []);
        }

        // Load full bank details list
        const detailsRes = await fetch("/api/bank-details");
        const detailsJson = await detailsRes.json();
        if (detailsJson.data) {
          setBankDetails(detailsJson.data);
        }

        // Load transaction detail
        const res = await fetch(`/api/bank-transaction/${id}`);
        const json = await res.json();
        if (json.success && json.data) {
          const t = json.data;
          setAccountId(String(t.ACCOUNT_ID));
          setTransactionDate(t.TRANSACTION_DATE || "");
          setTransactionType(t.ACCOUNTING_TRANSACTION_TYPE || "BTTI");
          setCategoryType(t.CATEGORY_TYPE || "");
          setCategory(t.CATEGORY || "");
          
          const resolvedAmount = t.ACCOUNTING_TRANSACTION_TYPE === "BTTI" 
            ? String(t.CREDIT_AMOUNT || "0") 
            : String(t.DEBIT_AMOUNT || "0");
          setAmount(resolvedAmount);

          setParticulars(t.PARTICULARS || "");
          setChqnoRefno(t.CHQNO_REFNO || "");
          setClosingBal(String(t.CLOSING_BAL || "0"));
          setSol(String(t.SOL || "0"));
          setDescription(t.DESCRIPTION || "");
          setNotes(t.NOTES || "");
          setTransactionStatus(String(t.TRANSACTION_STATUS || "1"));
        } else {
          toast.error("Failed to load transaction data");
          router.push("/bank-transaction");
        }
      } catch (err) {
        console.error("Error loading edit page:", err);
        toast.error("Error loading transaction detail");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, router]);

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
        transaction_status: parseInt(transactionStatus) || 1,
      };

      const res = await fetch(`/api/bank-transaction/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Bank transaction updated successfully");
        router.push("/bank-transaction");
      } else {
        toast.error(json.message || "Failed to update transaction");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating bank transaction");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 space-y-2">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <span>Loading transaction data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      {/* Header Card (Matches BreadcrumbHeader Design) */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span>Bank Transaction</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Edit</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 animate-in fade-in slide-in-from-left-2 duration-200">
                Edit Bank Transaction
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="submit"
              form="transaction-form"
              disabled={saving}
              size="icon"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Link href="/bank-transaction">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-red-100 hover:border-red-200 bg-white hover:bg-red-50 text-red-500 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Card className="rounded-3xl border shadow-sm bg-white overflow-hidden text-left">
        <form id="transaction-form" onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            {/* Account */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-slate-700">
                  Account
                  <span className="text-red-500"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="hover:bg-slate-50">
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
                <label className="text-sm font-semibold text-slate-700">Bank Name</label>
              </div>
              <div className="w-3/4">
                <Input
                  type="text"
                  disabled
                  value={bankName}
                  placeholder="Select an option"
                  className="w-1/2 h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-500 font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            {/* Accounting Transaction Type */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-slate-700">
                  Accounting Transaction Type
                  <span className="text-red-500"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                    <SelectItem value="BTTI" className="hover:bg-slate-50">Incoming / Receipt (Credit)</SelectItem>
                    <SelectItem value="BTTO" className="hover:bg-slate-50">Outgoing / Payment (Debit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category Type */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-slate-700">
                  Category Type
                  <span className="text-red-500"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={categoryType} onValueChange={handleCategoryTypeChange}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                    {categoryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="hover:bg-slate-50">
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
                <label className="text-sm font-semibold text-slate-700">Category</label>
              </div>
              <div className="w-3/4">
                <Select value={category} onValueChange={setCategory} disabled={!categoryType}>
                  <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="hover:bg-slate-50">
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
                <label className="text-sm font-semibold text-slate-700">Description</label>
              </div>
              <div className="w-3/4">
                <Textarea
                  placeholder="Add description details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-1/2 min-h-[80px] rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Transaction Date */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-slate-700">
                  Transaction Date
                  <span className="text-red-500"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Transaction Amount */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end">
                <label className="text-sm font-semibold text-slate-700">
                  Transaction Amount
                  <span className="text-red-500"> *</span>
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
                  className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
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
                  className="h-10 px-5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50/50 font-bold gap-1.5 transition-all duration-200 bg-white cursor-pointer"
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
              <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Particulars */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-slate-700">Particulars</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="text"
                      placeholder="e.g. Transaction Details"
                      value={particulars}
                      onChange={(e) => setParticulars(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>

                {/* Cheque / Ref No */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-slate-700">Cheque / Ref No</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="text"
                      placeholder="e.g. CHQ-92834"
                      value={chqnoRefno}
                      onChange={(e) => setChqnoRefno(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>

                {/* Closing Balance */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-slate-700">Closing Balance</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="number"
                      step="0.01"
                      value={closingBal}
                      onChange={(e) => setClosingBal(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>

                {/* SOL */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-slate-700">SOL</label>
                  </div>
                  <div className="w-3/4">
                    <Input
                      type="number"
                      value={sol}
                      onChange={(e) => setSol(e.target.value)}
                      className="w-1/2 h-10 rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>

                {/* Transaction Status */}
                <div className="flex gap-2 items-center">
                  <div className="w-1/4 text-end">
                    <label className="text-sm font-semibold text-slate-700">Transaction Status</label>
                  </div>
                  <div className="w-3/4">
                    <Select value={transactionStatus} onValueChange={setTransactionStatus}>
                      <SelectTrigger className="w-1/2 h-10 rounded-xl border-slate-200 bg-white">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                        <SelectItem value="1" className="hover:bg-slate-50">Pending / Unexplained</SelectItem>
                        <SelectItem value="2" className="hover:bg-slate-50">Explained</SelectItem>
                        <SelectItem value="3" className="hover:bg-slate-50">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex gap-2 items-start pt-1">
                  <div className="w-1/4 text-end pt-1.5">
                    <label className="text-sm font-semibold text-slate-700">Notes</label>
                  </div>
                  <div className="w-3/4">
                    <Textarea
                      placeholder="Internal audit notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-1/2 min-h-[80px] rounded-xl border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 flex justify-start gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-md shadow-blue-200/50 border-0 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>

            <Link href="/bank-transaction">
              <Button type="button" variant="outline" className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-100/50 font-bold text-slate-600 bg-white cursor-pointer">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
