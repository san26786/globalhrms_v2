"use client"
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, FileText } from 'lucide-react';
import DonutChart from '../DonutChart';
import BarChart from '../BarChart';
import LineChart from '../LineChart';
import PendingTable from './PendingTable';
import { EmployeeDashboardData, NamedCount } from '@/lib/dashboard/types';
import { authFetch } from '@/lib/auth/authFetch';

// ---------------------------------------------------------------------------
// Small local donut-arc helper. Preserves the exact SVG structure/geometry
// (r=25, strokeWidth=50, circumference≈157) that was previously hand-computed
// and hardcoded for the Gender Split / Employee Status cards, but now derives
// the dash-offsets/rotations from real segment percentages instead of fixed
// numbers baked into the markup.
// ---------------------------------------------------------------------------
const CIRCUMFERENCE = 157; // 2 * PI * 25, rounded to match the original markup

interface Arc {
  name: string;
  count: number;
  percentage: number;
  color: string;
  strokeDashoffset: number;
  rotation: number;
}

function buildArcs(segments: NamedCount[], colorFor: (name: string) => string): Arc[] {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  let accumulated = 0;
  return segments.map((s, index) => {
    const safeName = s.name ?? `Unknown-${index}`;
    const percentage = total > 0 ? (s.count / total) * 100 : 0;
    const strokeDashoffset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
    const rotation = (accumulated / 100) * 360;
    accumulated += percentage;
    return { name: safeName, count: s.count, percentage, color: colorFor(safeName), strokeDashoffset, rotation };
  });
}

/** Best-effort color assignment so real MSTR_NM values line up with the original palette. */
function genderColor(name: string | undefined | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('male') && !n.includes('female')) return '#f97316';
  if (n.includes('female')) return '#ef4444';
  return '#2563eb';
}

function statusColor(name: string | undefined | null): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('current')) return '#2563eb';
  if (n.includes('former')) return '#ef4444';
  return '#64748b';
}

function formatPct(pct: number): string {
  return `${Math.round(pct * 10) / 10}%`;
}

export default function EmployeeDashboard() {
  const [viewMode, setViewMode] = useState<'analytics' | 'demographics'>('analytics');
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch('/api/dashboard/employee');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load dashboard data');
        if (!cancelled) setData(json.data as EmployeeDashboardData);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = [
    { label: 'TOTAL NO OF REGISTERED EMPLOYEE', value: data?.kpis.totalRegistered ?? 0 },
    { label: 'TOTAL NO OF CURRENT EMPLOYEE', value: data?.kpis.totalCurrent ?? 0 },
    { label: 'TOTAL NO OF FORMER EMPLOYEE', value: data?.kpis.totalFormer ?? 0 },
    { label: 'TOTAL NO OF EMPLOYEES ON PROBATION', value: data?.kpis.totalProbation ?? 0 },
    { label: 'TOTAL NO OF EMPLOYEE REGISTERED IN CURRENT MONTH', value: data?.kpis.registeredThisMonth ?? 0 },
    { label: 'TOTAL NO OF EMPLOYEE RESIGNED IN CURRENT MONTH', value: data?.kpis.resignedThisMonth ?? 0 },
  ];

  const genderArcs = buildArcs(data?.genderSplit ?? [], genderColor);
  const statusArcs = buildArcs(data?.employeeStatus ?? [], statusColor);
  const dominantGenderPct = genderArcs.length > 0 ? formatPct(Math.max(...genderArcs.map((a) => a.percentage))) : '0%';
  const dominantStatusPct = statusArcs.length > 0 ? formatPct(Math.max(...statusArcs.map((a) => a.percentage))) : '0%';

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
            {error && <span className="text-red-500 ml-2">({error})</span>}
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
              <DonutChart data={data?.departmentEngagement} />
            </div>
            <div className="h-full">
              <BarChart data={data?.salarySlabs} />
            </div>
          </div>

          {/* Charts Row 2: Line & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-full">
              <LineChart data={data?.joiningTrend} />
            </div>
            <div className="h-full">
              <PendingTable rows={data?.pendingLeave} />
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
                    {loading ? '—' : kpi.value}
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
                    {genderArcs.length === 0 ? (
                      <circle cx="50" cy="50" r="25" fill="transparent" stroke="#e2e8f0" strokeWidth="50" />
                    ) : (
                      genderArcs.map((arc) => (
                        <circle
                          key={arc.name}
                          cx="50"
                          cy="50"
                          r="25"
                          fill="transparent"
                          stroke={arc.color}
                          strokeWidth="50"
                          strokeDasharray={CIRCUMFERENCE}
                          strokeDashoffset={arc.strokeDashoffset}
                          transform={`rotate(${arc.rotation} 50 50)`}
                        />
                      ))
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-black text-white bg-slate-900/40 px-2 py-0.5 rounded-full">
                      {dominantGenderPct}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-slate-600">
                  {genderArcs.length === 0 ? (
                    <span className="text-slate-400">No data available.</span>
                  ) : (
                    genderArcs.map((arc) => (
                      <div key={arc.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
                        <span>{arc.name} ({formatPct(arc.percentage)})</span>
                      </div>
                    ))
                  )}
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
                    {statusArcs.length === 0 ? (
                      <circle cx="50" cy="50" r="25" fill="transparent" stroke="#e2e8f0" strokeWidth="50" />
                    ) : (
                      statusArcs.map((arc) => (
                        <circle
                          key={arc.name}
                          cx="50"
                          cy="50"
                          r="25"
                          fill="transparent"
                          stroke={arc.color}
                          strokeWidth="50"
                          strokeDasharray={CIRCUMFERENCE}
                          strokeDashoffset={arc.strokeDashoffset}
                          transform={`rotate(${arc.rotation} 50 50)`}
                        />
                      ))
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-black text-white bg-slate-900/40 px-2 py-0.5 rounded-full">
                      {dominantStatusPct}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-slate-600">
                  {statusArcs.length === 0 ? (
                    <span className="text-slate-400">No data available.</span>
                  ) : (
                    statusArcs.map((arc) => (
                      <div key={arc.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
                        <span>{arc.name} ({formatPct(arc.percentage)})</span>
                      </div>
                    ))
                  )}
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
                    {!data || data.pendingLeave.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-xs text-slate-400 font-medium">
                          No pending leave records found.
                        </td>
                      </tr>
                    ) : (
                      data.pendingLeave.map((row) => (
                        <tr key={row.leaveRequestId} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 text-left text-xs font-semibold text-slate-700">{row.employeeName}</td>
                          <td className="py-3 text-center text-xs text-slate-500">{row.reason}</td>
                          <td className="py-3 text-right text-xs text-slate-400 font-mono">
                            {new Date(row.dateApplied).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
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
