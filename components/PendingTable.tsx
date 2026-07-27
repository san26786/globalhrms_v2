import React from 'react';
import { PENDING_OUTDOOR_DATA } from '../data/mockData';

export default function PendingTable() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display font-semibold text-slate-800 text-base">
          Current Month Pending Outdoor
        </h3>
        <button className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
          View All
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 font-semibold">Employee Name</th>
              <th className="pb-3 font-semibold">Outdoor Reason</th>
              <th className="pb-3 font-semibold text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PENDING_OUTDOOR_DATA.map((employee) => (
              <tr
                key={employee.id}
                className="hover:bg-slate-50/50 transition-colors duration-150 group"
              >
                {/* Employee Name & Info */}
                <td className="py-3 pr-4 flex items-center gap-3">
                  <img
                    src={employee.avatar}
                    alt={employee.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border-2 border-slate-100 group-hover:border-blue-200 transition-colors shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                      {employee.name}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 font-mono truncate">
                      {employee.role}
                    </span>
                  </div>
                </td>

                {/* Outdoor Reason */}
                <td className="py-3 pr-4">
                  <span className="text-xs font-semibold text-slate-600">
                    {employee.outdoorReason}
                  </span>
                </td>

                {/* Date */}
                <td className="py-3 text-right">
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    {employee.date}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
