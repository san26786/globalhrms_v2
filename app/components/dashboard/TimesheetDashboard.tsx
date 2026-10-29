"use client"
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Clock, CheckCircle2, AlertCircle, Briefcase, ListChecks, CalendarCheck, BadgeCheck } from 'lucide-react';
import { TimesheetDashboardData } from '@/lib/dashboard/types';
import { PrimaryButton } from '@/components/auth/AuthUi';
import { Avatar, Badge, DashboardPage, InsightCard, Panel, Section, StatCard, Toast, fieldInput, fieldLabel, type Tone } from './DashboardUi';

interface TimesheetLog {
  id: string;
  employee: string;
  project: string;
  date: string;
  hours: number;
  task: string;
  status: 'Approved' | 'Pending' | 'Draft' | 'Rejected';
}

export default function TimesheetDashboard() {
  const [dashboardData, setDashboardData] = useState<TimesheetDashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/timesheet');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load timesheet data');
        if (!cancelled) setDashboardData(json.data as TimesheetDashboardData);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [kpis, setKpis] = useState({
    approved: 42,
    pending: 8,
    rejected: 1,
    drafted: 3
  });

  // Sync KPI tiles once real data arrives. The "Log Time" form below still
  // adjusts this same local state optimistically for its own mock entries —
  // see the Phase 16 README for the note on why the log feed itself (as
  // opposed to the KPI/fill-rate widgets) isn't wired to a query.
  useEffect(() => {
    if (dashboardData) {
      setKpis(dashboardData.kpis);
    }
  }, [dashboardData]);

  const [logs, setLogs] = useState<TimesheetLog[]>([
    { id: '1', employee: 'Rajesh Kumar', project: 'Global HR Migration', date: '10/07/2026', hours: 8, task: 'Database migration and schema optimization', status: 'Approved' },
    { id: '2', employee: 'Sandeep Yadav', project: 'Nexus Portal Dev', date: '10/07/2026', hours: 6.5, task: 'Auth context setup & router config', status: 'Pending' },
    { id: '3', employee: 'Priya Sharma', project: 'Brand Restructure', date: '09/07/2026', hours: 7, task: 'Header custom component updates', status: 'Approved' },
    { id: '4', employee: 'Ananya Sen', project: 'Global HR Migration', date: '09/07/2026', hours: 8.5, task: 'API proxy route setup and env mapping', status: 'Draft' },
  ]);

  const [formProject, setFormProject] = useState('Nexus Portal Dev');
  const [formHours, setFormHours] = useState('8');
  const [formDate, setFormDate] = useState('2026-07-10');
  const [formTask, setFormTask] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const projects = [
    'Nexus Portal Dev',
    'Global HR Migration',
    'Brand Restructure',
    'Enterprise Core APIs',
    'Compliance Audit'
  ];

  const handleSubmitTime = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(formHours) || 8;
    const dateParts = formDate.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : formDate;

    const newLog: TimesheetLog = {
      id: String(Date.now()),
      employee: 'You (DEMOadmin)',
      project: formProject,
      date: formattedDate,
      hours: hrs,
      task: formTask || 'General Software Engineering Task',
      status: 'Pending'
    };

    setLogs([newLog, ...logs]);

    // Update KPI metrics
    setKpis(prev => ({
      ...prev,
      pending: prev.pending + 1
    }));

    setFormTask('');
    triggerToast(`Logged ${hrs} hours on "${formProject}" successfully!`);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // pieCards — percentage + "N of M" description come from real data once
  // loaded; label/color keep the original cosmetic palette (matching the
  // original mock's "good/warning" color coding) since fill_rate queries
  // don't carry a semantic label of their own.
  const fallbackPieCards = [
    { title: 'Timesheet Today', percentage: 92, label: 'Submitted On Time', color: '#10b981', desc: '48 of 52 employees submitted' },
    { title: 'Timesheet Yesterday', percentage: 98, label: 'Submitted On Time', color: '#10b981', desc: '51 of 52 employees submitted' },
    { title: 'Timesheet Current Week', percentage: 86, label: 'Approved In Advance', color: '#3b82f6', desc: 'Core milestones fulfilled' },
    { title: 'Timesheet Last Week', percentage: 100, label: 'Completed All Logs', color: '#10b981', desc: 'All billing hours cleared' },
    { title: 'Timesheet Current Month', percentage: 95, label: 'Fidelity Validated', color: '#f59e0b', desc: 'Audit verified with corporate' }
  ];

  const pieCards = dashboardData
    ? [
        { ...fallbackPieCards[0], percentage: dashboardData.fillRates.today.percentage, desc: `${dashboardData.fillRates.today.filled} of ${dashboardData.fillRates.today.total} timesheets submitted` },
        { ...fallbackPieCards[1], percentage: dashboardData.fillRates.yesterday.percentage, desc: `${dashboardData.fillRates.yesterday.filled} of ${dashboardData.fillRates.yesterday.total} timesheets submitted` },
        { ...fallbackPieCards[2], percentage: dashboardData.fillRates.currentWeek.percentage, desc: `${dashboardData.fillRates.currentWeek.filled} of ${dashboardData.fillRates.currentWeek.total} timesheets submitted` },
        { ...fallbackPieCards[3], percentage: dashboardData.fillRates.lastWeek.percentage, desc: `${dashboardData.fillRates.lastWeek.filled} of ${dashboardData.fillRates.lastWeek.total} timesheets submitted` },
        { ...fallbackPieCards[4], percentage: dashboardData.fillRates.currentMonth.percentage, desc: `${dashboardData.fillRates.currentMonth.filled} of ${dashboardData.fillRates.currentMonth.total} timesheets submitted` },
      ]
    : fallbackPieCards;

  const kpiCards = [
    { label: 'TIMESHEETS APPROVED', value: kpis.approved, color: 'from-[#00b0ff] to-[#0091ea]', icon: CheckCircle2, desc: 'Locked and verified for payroll' },
    { label: 'TIMESHEETS PENDING', value: kpis.pending, color: 'from-[#1565c0] to-[#0d47a1]', icon: Clock, desc: 'Awaiting administrator audit' },
    { label: 'TIMESHEETS REJECTED', value: kpis.rejected, color: 'from-[#ff5252] to-[#ff1744]', icon: AlertCircle, desc: 'Requires employee correction' },
    { label: 'TIMESHEETS DRAFTED', value: kpis.drafted, color: 'from-[#00e676] to-[#00c853]', icon: FileText, desc: 'Saved progress in workspace' }
  ];

  return (
    <DashboardPage>
      {/* Toast Alert */}
      <AnimatePresence>{toastMessage && <Toast key={toastMessage}>{toastMessage}</Toast>}</AnimatePresence>

      {/* Top row: 4 KPI Cards */}
      <Section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi, idx) => (
          <StatCard key={idx} icon={kpi.icon} label={kpi.label} value={kpi.value} hint={kpi.desc} tone={KPI_TONES[idx]} />
        ))}
      </Section>

      {/* Middle Grid Row: Interactive Time logger & live feed */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Interactive hours logger */}
        <Panel title="Log hours terminal" icon={Briefcase} tone="orange">
          <form onSubmit={handleSubmitTime} className="flex h-full flex-col justify-between gap-5 p-5">
            <div className="space-y-4">
              <p className="text-[13.5px] leading-relaxed text-[#535768] dark:text-[#aab3c5]">
                Log development or administrative tasks directly to project timesheets. Approved logs immediately compile into reports.
              </p>

              {/* Project select */}
              <div>
                <label htmlFor="timesheet-project" className={fieldLabel}>Target project</label>
                <select
                  id="timesheet-project"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className={`${fieldInput} cursor-pointer`}
                >
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Date & Hours row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="timesheet-hours" className={fieldLabel}>Hours worked</label>
                  <input
                    id="timesheet-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    required
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    className={fieldInput}
                  />
                </div>
                <div>
                  <label htmlFor="timesheet-date" className={fieldLabel}>Log date</label>
                  <input
                    id="timesheet-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>

              {/* Task description */}
              <div>
                <label htmlFor="timesheet-task" className={fieldLabel}>Task deliverables description</label>
                <input
                  id="timesheet-task"
                  type="text"
                  required
                  placeholder="e.g. Developed landing page layout, set up env configs"
                  value={formTask}
                  onChange={(e) => setFormTask(e.target.value)}
                  className={fieldInput}
                />
              </div>
            </div>

            <PrimaryButton loading={false} loadingText="">
              Register timesheet log
            </PrimaryButton>
          </form>
        </Panel>

        {/* Live timesheet feed table */}
        <Panel
          title="Recent worklogs registry"
          icon={ListChecks}
          tone="blue"
          className="lg:col-span-2"
          badge={<Badge tone="blue" pulse>Active registry logs</Badge>}
        >
          <ul className="max-h-[440px] divide-y divide-slate-100 dark:divide-white/10 overflow-y-auto px-2 py-2">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.li
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col justify-between gap-3 rounded-xl px-3 py-3.5 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar tone="slate">{log.employee.charAt(0)}</Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{log.employee}</p>
                        <span className="rounded-md bg-[#e3edf9] dark:bg-[#16233d] px-2 py-0.5 text-[12px] font-medium text-[#083f72] dark:text-[#cfe1fa]">{log.project}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] italic text-[#535768] dark:text-[#aab3c5]">{log.task}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-[14px] font-semibold tabular-nums text-[#1a1818] dark:text-[#f1f3f8]">{log.hours} Hrs</p>
                      <p className="text-[12px] text-[#535768] dark:text-[#aab3c5]">{log.date}</p>
                    </div>
                    <Badge tone={log.status === 'Approved' ? 'emerald' : log.status === 'Draft' ? 'slate' : 'amber'}>{log.status}</Badge>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Panel>
      </Section>

      {/* Fill-rate rings */}
      <Section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pieCards.map((card, idx) => (
          <Panel key={idx} title={card.title} icon={CalendarCheck} tone="blue" bodyClassName="flex flex-col items-center justify-center p-6">
            {/* SVG Ring represent percentages */}
            <div className="relative flex h-36 w-36 select-none items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="38" fill="transparent" className="stroke-[#eef1f6] dark:stroke-white/10" strokeWidth="10" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke={card.color}
                  strokeWidth="10"
                  strokeDasharray="238.76"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 238.76 }}
                  animate={{ strokeDashoffset: Number((238.76 - (238.76 * card.percentage) / 100).toFixed(2)) }}
                  transition={{ duration: 1.1, delay: 0.2 + idx * 0.08, ease: [0.515, 0.147, 0.25, 1] }}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#1a1818] dark:text-[#f1f3f8]">{card.percentage}%</span>
                <span className="mt-1.5 text-[12px] font-medium text-[#535768] dark:text-[#aab3c5]">Submitted</span>
              </div>
            </div>

            {/* Legend label */}
            <div className="mt-4 flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2 text-[14px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                <span>{card.label}</span>
              </div>
              <span className="text-[12.5px] text-[#535768] dark:text-[#aab3c5]">{card.desc}</span>
            </div>
          </Panel>
        ))}

        {/* Audit validation helper */}
        <InsightCard className="min-h-[260px]">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium uppercase tracking-widest text-[#fde4d8] ring-1 ring-inset ring-white/15">
              <BadgeCheck aria-hidden="true" className="h-4 w-4" />
              Enterprise audit
            </span>
            <h4 className="text-[20px] font-medium leading-snug tracking-[-0.01em]">Audit status: VALIDATED</h4>
            <p className="text-[14px] leading-relaxed text-white/90">
              Enterprise timesheets have been matched against corporate work scopes and clock parameters successfully. All metrics are calibrated to support multi-regional billing cycles with the active brand profile.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/15 pt-4 text-[13px]">
            <span className="text-white/90">Audit cycle: 2026-Q3</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              CLEARED
            </span>
          </div>
        </InsightCard>
      </Section>
    </DashboardPage>
  );
}

// Approved, pending, rejected, drafted.
const KPI_TONES: Tone[] = ['emerald', 'blue', 'rose', 'slate'];
