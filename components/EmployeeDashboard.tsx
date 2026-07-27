import React, { useState } from 'react';
import { LayoutDashboard, Users, FileText } from 'lucide-react';
import DonutChart from './DonutChart';
import BarChart from './BarChart';
import LineChart from './LineChart';
import PendingTable from './PendingTable';

export default function EmployeeDashboard() {
  const [viewMode, setViewMode] = useState<'analytics' | 'demographics'>('analytics');

  const kpis = [
    { label: 'TOTAL NO OF REGISTERED EMPLOYEE', value: 75 },
    { label: 'TOTAL NO OF CURRENT EMPLOYEE', value: 73 },
    { label: 'TOTAL NO OF FORMER EMPLOYEE', value: 2 },
    { label: 'TOTAL NO OF EMPLOYEES ON PROBATION', value: 51 },
    { label: 'TOTAL NO OF EMPLOYEE REGISTERED IN CURRENT MONTH', value: 0 },
    { label: 'TOTAL NO OF EMPLOYEE RESIGNED IN CURRENT MONTH', value: 0 }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Sliding View Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-5 mb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            Employee Workspace
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {viewMode === 'analytics' 
              ? 'Real-time charts representing department engagement, salary slabs, and joinings.' 
              : 'Detailed demographic proportions, status checks, and current leave pipelines.'}
          </p>
        </div>
        
        {/* Toggle Pills */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 select-none border border-slate-200/40">
          <button
            id="toggle-view-analytics"
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              viewMode === 'analytics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Analytics Overview
          </button>
          <button
            id="toggle-view-demographics"
            onClick={() => setViewMode('demographics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              viewMode === 'demographics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Demographics & KPIs
          </button>
        </div>
      </div>

      {/* Conditionally Render Content based on viewMode */}
      {viewMode === 'analytics' ? (
        <div className="space-y-6">
          {/* Charts Row 1: Donut & Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-full">
              <DonutChart />
            </div>
            <div className="h-full">
              <BarChart />
            </div>
          </div>

          {/* Charts Row 2: Line & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-full">
              <LineChart />
            </div>
            <div className="h-full">
              <PendingTable />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
          {/* KPI Cards: Grid of 3x2 exactly like the demographics sheet */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-slate-150 overflow-hidden flex items-stretch h-24"
              >
                {/* Bright sky blue box with icon on the left */}
                <div className="bg-[#00b0ff] w-20 flex items-center justify-center shrink-0">
                  <FileText className="w-8 h-8 text-white stroke-[1.5]" />
                </div>
                
                {/* Label and Count on the right */}
                <div className="flex-1 p-4 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-tight">
                    {kpi.label}
                  </span>
                  <span className="text-3xl font-black text-slate-700 mt-1 font-sans">
                    {kpi.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Visual Analytics Sections underneath (3 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gender Split Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-white px-5 py-3 border-b border-slate-100 text-center">
                <h3 className="font-sans font-bold text-slate-700 text-sm">
                  Employee Gender Split
                </h3>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 select-none">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="transparent"
                      stroke="#f97316"
                      strokeWidth="50"
                      strokeDasharray="157"
                      strokeDashoffset="63.6"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth="50"
                      strokeDasharray="157"
                      strokeDashoffset="123"
                      transform="rotate(214.2 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="transparent"
                      stroke="#2563eb"
                      strokeWidth="50"
                      strokeDasharray="157"
                      strokeDashoffset="152.7"
                      transform="rotate(350.28 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-black text-white bg-slate-900/40 px-2 py-0.5 rounded-full">
                      59.5%
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                    <span>Error (2.7%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span>Female (37.8%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                    <span>Male (59.5%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Status Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-white px-5 py-3 border-b border-slate-100 text-center">
                <h3 className="font-sans font-bold text-slate-700 text-sm">
                  Employee Status
                </h3>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center">
                <div className="relative w-44 h-44 select-none">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="transparent"
                      stroke="#2563eb"
                      strokeWidth="50"
                      strokeDasharray="157"
                      strokeDashoffset="4.24"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth="50"
                      strokeDasharray="157"
                      strokeDashoffset="152.76"
                      transform="rotate(350.28 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-black text-white bg-slate-900/40 px-2 py-0.5 rounded-full">
                      97.3%
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                    <span>Current (97.3%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span>Former (2.7%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Leave Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-white px-5 py-3 border-b border-slate-100 text-center">
                <h3 className="font-sans font-bold text-slate-700 text-sm">
                  Pending Leave
                </h3>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-start">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2 font-bold text-left">Employee Name</th>
                      <th className="pb-2 font-bold text-center">Reason For Leave</th>
                      <th className="pb-2 font-bold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-xs text-slate-400 font-medium">
                        No pending leave records found.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
