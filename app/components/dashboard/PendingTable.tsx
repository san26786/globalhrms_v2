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
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display font-semibold text-slate-800 text-base">
          {title}
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-start">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  className="py-12 text-center text-xs text-slate-400 font-medium"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.leaveRequestId ?? "pending"}-${row.employeeName}-${row.dateApplied}-${index}`}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-3 text-left text-xs font-semibold text-slate-700">
                    {row.employeeName}
                  </td>

                  <td className="py-3 text-center text-xs text-slate-500">
                    {row.reason}
                  </td>

                  <td className="py-3 text-right text-xs text-slate-400 font-mono">
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