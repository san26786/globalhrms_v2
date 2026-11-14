"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, PlusCircle, ReceiptIndianRupee } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DeclarationPage, SectionCode } from "@/lib/payroll/declarations/declarationTypes";
import { useInit } from "../../../systmMngt/_shared/useInit";
import { declarationApi, amountText } from "./declarationClient";
import { MedicalDialog, SimpleSectionDialog, TaxSavingsDialog, isSimpleCode } from "./SectionDialogs";

/**
 * CI employeeMngt/emp_investment_declarations/index/{id} (include/investment_declaration_v): the employee's Investment
 * Declaration for the year of an Investment Details record — CI's summary cards (CTC, Total Investment, Total Benefit,
 * Total Prof. Tax, Total Standard Dedct., Total Taxable Income, Total Tax Payable), then one card per section master
 * (name, "Max Benefit" of the year's rule, description, declared amount) whose "Add Declaration" button opens the
 * section's dialog (SectionDialogs). Rules: lib/payroll/declarations.
 *
 * Behaviour changes: the cards are reloaded after every save (CI updated the totals only); the three sections CI
 * listed without a form (Income of Other Persons; Interest, Dividends & Other Income; Sale of Investments / Property)
 * show no button (CI's button did nothing); Prof. Tax and Standard Deduction are the year's actual figures (CI always
 * showed 2500 and 50000); without the add / edit grant the dialogs open read-only.
 */
const card = "rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 dark:border-white/10 dark:bg-[#111a2e]";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9aa4b8]">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800 dark:text-[#e6e9ef]">{value}</p>
    </div>
  );
}

export default function DeclarationsPage({ investment }: { investment: string }) {
  const { data, error, reload } = useInit<DeclarationPage>(declarationApi(investment));
  const [open, setOpen] = useState<SectionCode | null>(null);

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-400">Loading…</p>;

  const { header, summary } = data;
  const fig = (v: number | null) => (v === null ? "—" : amountText(v));
  const emp = header.employee;
  const back = `/employeeMngt/emp_investments/edit/${header.id}?emp=${emp.id}`;
  const onChanged = (close: boolean) => {
    if (close) setOpen(null);
    reload();
  };
  const dialogProps = { page: data, onClose: () => setOpen(null), onChanged };

  return (
    <div className="space-y-4 p-4">
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-[#9aa4b8]">
          <span>Employee Hub</span>
          <ChevronRight size={15} className="text-slate-400" />
          <Link href={`/employeeMngt/emp_investments?emp=${emp.id}`} className="hover:underline">
            Investment Details
          </Link>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">Investment Declaration</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ReceiptIndianRupee className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-[#e6e9ef]">Investment Declaration</h1>
              <p className="text-xs text-slate-500">
                {emp.name}
                {emp.code ? ` (${emp.code})` : ""} · {header.fy.name ?? `Financial year #${header.fy.id}`}
                {summary.regime ? ` · ${summary.regime === "new" ? "New" : "Old"} tax regime` : ""}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-9 px-4">
            <Link href={back}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {data.notices.length || summary.note ? (
        <div role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {[...data.notices, ...(summary.note ? [summary.note] : [])].map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="CTC" value={summary.ctc === null ? "0" : amountText(summary.ctc)} />
        <SummaryCard label="Total Investment" value={amountText(header.totals.investment)} />
        <SummaryCard label="Total Benefit" value={amountText(header.totals.benefit)} />
        <SummaryCard label="Total Prof. Tax" value={fig(summary.professionalTax)} />
        <SummaryCard label="Total Standard Dedct." value={fig(summary.standardDeduction)} />
        <SummaryCard label="Total Taxable Income" value={fig(summary.taxableIncome)} />
        <SummaryCard label="Total Tax Payable" value={fig(summary.taxPayable)} />
      </div>

      <div className="space-y-3">
        {data.sections.map((s) => (
          <div key={s.code} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-[#e6e9ef]">
                  {s.name}
                  {s.maxBenefit ? <span className="font-normal text-slate-500"> → Max Benefit : {s.maxBenefit === "∞" ? "∞" : amountText(s.maxBenefit)}</span> : null}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-[#c3cad6]">{s.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-lg font-bold text-slate-800 dark:text-[#e6e9ef]">{amountText(s.amount)}</span>
                {s.form ? (
                  <Button
                    variant="outline"
                    className="h-9 px-3"
                    title={data.canEdit ? "Add Declaration" : "View Declaration"}
                    aria-label={`${data.canEdit ? "Add Declaration" : "View Declaration"}: ${s.name}`}
                    onClick={() => setOpen(s.code as SectionCode)}
                  >
                    <PlusCircle className="h-4 w-4" />
                    {data.canEdit ? "Add Declaration" : "View"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && isSimpleCode(open) ? <SimpleSectionDialog key={open} code={open} {...dialogProps} /> : null}
      {open === "IPIITS" ? <TaxSavingsDialog {...dialogProps} /> : null}
      {open === "IPME" ? <MedicalDialog {...dialogProps} /> : null}
    </div>
  );
}
