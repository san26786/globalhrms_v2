"use client";

import React from "react";

export interface PendingTableRow {
  leaveRequestId?: number | string | null;
  employeeName: string;
  reason: string;
  dateApplied: string;
}

interface PendingTableProps {
  title?: string;
  rows?: PendingTableRow[];
  emptyLabel?: string;
}

export default function PendingTable({
  title = "Pending Leave",
  rows = [],
  emptyLabel = "No pending leave records found.",
}: PendingTableProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white dark:bg-[#111a2e] p-6 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[15px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">
          {title}
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-start">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/10 text-[12px] font-medium text-[#535768] dark:text-[#aab3c5]">
              <th className="pb-2 font-bold text-left">Employee Name</th>
              <th className="pb-2 font-bold text-center">
                Reason For Leave
              </th>
              <th className="pb-2 font-bold text-right">Date</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr key="empty-row">
                <td
                  colSpan={3}
                  className="py-12 text-center text-[13px] text-[#535768] dark:text-[#aab3c5]"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.leaveRequestId ?? "pending"}-${row.employeeName}-${row.dateApplied}-${index}`}
                  className="border-t border-slate-100 dark:border-white/10 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5"
                >
                  <td className="py-3 text-left text-[14px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">
                    {row.employeeName}
                  </td>

                  <td className="py-3 text-center text-[13px] text-[#323338] dark:text-[#d5dae4]">
                    {row.reason}
                  </td>

                  <td className="py-3 text-right text-[13px] tabular-nums text-[#535768] dark:text-[#aab3c5]">
                    {row.dateApplied
                      ? new Date(row.dateApplied).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}