"use client"
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, Users, UserCheck, UserMinus, Hourglass, UserPlus, UserX, PieChart, CalendarClock, type LucideIcon } from 'lucide-react';
import DonutChart from '../DonutChart';
import BarChart from '../BarChart';
import LineChart from '../LineChart';
import PendingTable from './PendingTable';
import { EmployeeDashboardData, NamedCount } from '@/lib/dashboard/types';
import { DashboardPage, Panel, ScrollConverge, StatCard, pageRise, pageStagger, type Tone } from './DashboardUi';

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
        const res = await fetch('/api/dashboard/employee');
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
    <DashboardPage>

      {/* Sliding View Mode Switcher */}
      <motion.div variants={pageRise} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-medium leading-tight tracking-[-0.03em] text-[#1a1818] dark:text-[#f1f3f8]">Employee workspace</h2>
          <p className="mt-1 text-[14px] text-[#535768] dark:text-[#aab3c5]">
            {viewMode === 'analytics'
              ? 'Real-time charts representing department engagement, salary slabs, and joinings.'
              : 'Detailed demographic proportions, status checks, and current leave pipelines.'}
            {error && <span className="ml-2 text-rose-800 dark:text-rose-300">({error})</span>}
          </p>
        </div>

        {/* Toggle Pills */}
        <div className="flex select-none items-center gap-1 rounded-full bg-white dark:bg-[#111a2e] p-1 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm">
          <button
            id="toggle-view-analytics"
            onClick={() => setViewMode('analytics')}
            aria-pressed={viewMode === 'analytics'}
            className={`relative flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors duration-200 cursor-pointer ${
              viewMode === 'analytics' ? 'text-white' : 'text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white'
            }`}
          >
            {viewMode === 'analytics' && <motion.span layoutId="employee-view-pill" className="absolute inset-0 rounded-full bg-[#e15425] shadow-[0_8px_18px_-10px_rgba(225,84,37,0.8)]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <span className="relative flex items-center gap-2">
              <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
              Analytics overview
            </span>
          </button>
          <button
            id="toggle-view-demographics"
            onClick={() => setViewMode('demographics')}
            aria-pressed={viewMode === 'demographics'}
            className={`relative flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors duration-200 cursor-pointer ${
              viewMode === 'demographics' ? 'text-white' : 'text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white'
            }`}
          >
            {viewMode === 'demographics' && <motion.span layoutId="employee-view-pill" className="absolute inset-0 rounded-full bg-[#e15425] shadow-[0_8px_18px_-10px_rgba(225,84,37,0.8)]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <span className="relative flex items-center gap-2">
              <Users aria-hidden="true" className="h-4 w-4" />
              Demographics &amp; KPIs
            </span>
          </button>
        </div>
      </motion.div>

      {/* Conditionally Render Content based on viewMode */}
      <AnimatePresence mode="wait">
        {viewMode === 'analytics' ? (
          <motion.div key="analytics" variants={pageStagger} initial="hidden" animate="show" exit={VIEW_EXIT} className="space-y-6">
            {/* Charts Row 1: Donut & Bar */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ScrollConverge index={0} count={2}>
                <motion.div variants={pageRise} className="h-full">
                  <DonutChart data={data?.departmentEngagement} />
                </motion.div>
              </ScrollConverge>
              <ScrollConverge index={1} count={2}>
                <motion.div variants={pageRise} className="h-full">
                  <BarChart data={data?.salarySlabs} />
                </motion.div>
              </ScrollConverge>
            </div>

            {/* Charts Row 2: Line & Table */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ScrollConverge index={0} count={2}>
                <motion.div variants={pageRise} className="h-full">
                  <LineChart data={data?.joiningTrend} />
                </motion.div>
              </ScrollConverge>
              <ScrollConverge index={1} count={2}>
                <motion.div variants={pageRise} className="h-full">
                  <PendingTable rows={data?.pendingLeave} />
                </motion.div>
              </ScrollConverge>
            </div>
          </motion.div>
        ) : (
          <motion.div key="demographics" variants={pageStagger} initial="hidden" animate="show" exit={VIEW_EXIT} className="space-y-6">
            {/* KPI Cards: Grid of 3x2 exactly like the demographics sheet */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((kpi, idx) => (
                <ScrollConverge key={idx} index={idx} count={kpis.length}>
                  <StatCard icon={KPI_ICONS[idx]} label={kpi.label} value={kpi.value} tone={KPI_TONES[idx]} loading={loading} />
                </ScrollConverge>
              ))}
            </div>

            {/* Visual Analytics Sections underneath (3 Columns) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Gender Split Card */}
              <ScrollConverge index={0} count={3}>
                <Panel title="Employee gender split" icon={PieChart} tone="orange" bodyClassName="flex flex-col items-center justify-center p-6">
                  <div className="relative h-44 w-44 select-none">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" className="-rotate-90">
                      {genderArcs.length === 0 ? (
                        <circle cx="50" cy="50" r="25" fill="transparent" className="stroke-[#e2e8f0] dark:stroke-white/10" strokeWidth="50" />
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-[#1a1818]/75 px-2.5 py-1 text-[13px] font-semibold text-white">{dominantGenderPct}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-[#323338] dark:text-[#d5dae4]">
                    {genderArcs.length === 0 ? (
                      <span className="text-[#535768] dark:text-[#aab3c5]">No data available.</span>
                    ) : (
                      genderArcs.map((arc) => (
                        <div key={arc.name} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
                          <span>{arc.name} ({formatPct(arc.percentage)})</span>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              </ScrollConverge>

              {/* Employee Status Card */}
              <ScrollConverge index={1} count={3}>
                <Panel title="Employee status" icon={UserCheck} tone="blue" bodyClassName="flex flex-col items-center justify-center p-6">
                  <div className="relative h-44 w-44 select-none">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" className="-rotate-90">
                      {statusArcs.length === 0 ? (
                        <circle cx="50" cy="50" r="25" fill="transparent" className="stroke-[#e2e8f0] dark:stroke-white/10" strokeWidth="50" />
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-[#1a1818]/75 px-2.5 py-1 text-[13px] font-semibold text-white">{dominantStatusPct}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-[#323338] dark:text-[#d5dae4]">
                    {statusArcs.length === 0 ? (
                      <span className="text-[#535768] dark:text-[#aab3c5]">No data available.</span>
                    ) : (
                      statusArcs.map((arc) => (
                        <div key={arc.name} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
                          <span>{arc.name} ({formatPct(arc.percentage)})</span>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              </ScrollConverge>

              {/* Pending Leave Card */}
              <ScrollConverge index={2} count={3}>
                <Panel title="Pending leave" icon={CalendarClock} tone="amber">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="text-[12px] font-medium text-[#535768] dark:text-[#aab3c5]">
                        <th className="px-5 pb-2 pt-3 font-medium">Employee name</th>
                        <th className="px-5 pb-2 pt-3 text-center font-medium">Reason for leave</th>
                        <th className="px-5 pb-2 pt-3 text-right font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data || data.pendingLeave.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-12 text-center text-[13px] text-[#535768] dark:text-[#aab3c5]">
                            No pending leave records found.
                          </td>
                        </tr>
                      ) : (
                        data.pendingLeave.map((row) => (
                          <tr key={row.leaveRequestId} className="border-t border-slate-100 dark:border-white/10 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                            <td className="px-5 py-3 text-[14px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">{row.employeeName}</td>
                            <td className="px-5 py-3 text-center text-[13px] text-[#323338] dark:text-[#d5dae4]">{row.reason}</td>
                            <td className="px-5 py-3 text-right text-[13px] tabular-nums text-[#535768] dark:text-[#aab3c5]">
                              {new Date(row.dateApplied).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Panel>
              </ScrollConverge>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </DashboardPage>
  );
}

const VIEW_EXIT = { opacity: 0, y: -8, transition: { duration: 0.2 } };

// Registered, current, former, probation, joined this month, resigned this month.
const KPI_ICONS: LucideIcon[] = [Users, UserCheck, UserMinus, Hourglass, UserPlus, UserX];
const KPI_TONES: Tone[] = ['blue', 'emerald', 'slate', 'amber', 'orange', 'rose'];
