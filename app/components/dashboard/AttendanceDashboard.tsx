"use client"
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Clock, FileCheck, Users, UserCheck, AlertTriangle, Sparkles, Radio, Hourglass, TimerOff } from 'lucide-react';
import { AttendanceDashboardData } from '@/lib/dashboard/types';
import { PrimaryButton } from '@/components/auth/AuthUi';
import { Avatar, Badge, DashboardPage, InsightCard, Panel, RankTable, Section, StatCard, Toast, fieldInput, fieldLabel, type Tone } from './DashboardUi';
import { authFetch } from '@/lib/auth/authFetch';

interface AttendanceLog {
  id: string;
  name: string;
  type: 'Present' | 'Absent' | 'Early Going' | 'Late Entry';
  time: string;
  status: string;
  avatar: string;
}

export default function AttendanceDashboard() {
  const [dashboardData, setDashboardData] = useState<AttendanceDashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/dashboard/attendance');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load attendance data');
        if (!cancelled) setDashboardData(json.data as AttendanceDashboardData);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Failed to load attendance data');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [kpis, setKpis] = useState({
    present: 74,
    absent: 2,
    earlyGoing: 5,
    lateEntry: 3
  });

  // Sync KPI tiles once real data arrives. The Quick Punch Terminal below still
  // adjusts this same local state optimistically for its own mock punches —
  // see the "Auth assumption" / "not backed by a query" note in the Phase 16
  // README regarding the live punch feed.
  useEffect(() => {
    if (dashboardData) {
      setKpis({
        present: dashboardData.kpis.presentToday,
        absent: dashboardData.kpis.absentToday,
        earlyGoing: dashboardData.kpis.earlyGoingToday,
        lateEntry: dashboardData.kpis.lateEntryToday,
      });
    }
  }, [dashboardData]);

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([
    { id: '1', name: 'Rajesh Kumar', type: 'Present', time: '09:15 AM', status: 'On Time', avatar: 'RK' },
    { id: '2', name: 'Sandeep Yadav', type: 'Late Entry', time: '10:05 AM', status: 'Late (Approved)', avatar: 'SY' },
    { id: '3', name: 'Priya Sharma', type: 'Early Going', time: '04:30 PM', status: 'Early Left', avatar: 'PS' },
    { id: '4', name: 'Ananya Sen', type: 'Present', time: '09:22 AM', status: 'On Time', avatar: 'AS' },
    { id: '5', name: 'Amit Patel', type: 'Present', time: '09:05 AM', status: 'On Time', avatar: 'AP' },
  ]);

  const [activePunchState, setActivePunchState] = useState<'out' | 'in'>('out');
  const [punchType, setPunchType] = useState<'Present' | 'Early Going' | 'Late Entry'>('Present');
  const [punchNote, setPunchNote] = useState('');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Stats — populated from /api/dashboard/attendance; fall back to the
  // original mock rows while the request is in flight so the layout never
  // pops empty.
  const topPresent = dashboardData?.topPresent.length
    ? dashboardData.topPresent
    : [
        { name: 'Rajesh Kumar', count: 24 },
        { name: 'Sandeep Yadav', count: 23 },
        { name: 'Priya Sharma', count: 22 },
        { name: 'Ananya Sen', count: 22 },
        { name: 'Amit Patel', count: 21 },
      ];

  const topAbsent = dashboardData?.topAbsent.length
    ? dashboardData.topAbsent
    : [
        { name: 'Vikram Singh', count: 3 },
        { name: 'Sneha Reddy', count: 2 },
        { name: 'Rohan Mehra', count: 1 },
      ];

  const topHalfDays = dashboardData?.topHalfDays.length
    ? dashboardData.topHalfDays
    : [
        { name: 'Priya Sharma', count: 2 },
        { name: 'Amit Patel', count: 1 },
        { name: 'Sandeep Yadav', count: 1 },
      ];

  const earlyGoingList = dashboardData?.earlyGoingLast7Days.length
    ? dashboardData.earlyGoingLast7Days
    : [
        { name: 'Sandeep Yadav', count: 2 },
        { name: 'Priya Sharma', count: 2 },
        { name: 'Amit Patel', count: 1 },
      ];

  const handlePunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activePunchState === 'out') {
      // Punch In
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const newLog: AttendanceLog = {
        id: String(Date.now()),
        name: 'You (DEMOadmin)',
        type: punchType,
        time: timeStr,
        status: punchNote || 'Self Registered Punch',
        avatar: 'DA'
      };

      setAttendanceLogs([newLog, ...attendanceLogs]);
      
      // Update KPIs
      setKpis(prev => {
        const next = { ...prev };
        if (punchType === 'Present') next.present += 1;
        if (punchType === 'Early Going') next.earlyGoing += 1;
        if (punchType === 'Late Entry') next.lateEntry += 1;
        return next;
      });

      setActivePunchState('in');
      setPunchNote('');
      triggerToast(`Punched IN successfully as ${punchType}!`);
    } else {
      // Punch Out
      setActivePunchState('out');
      triggerToast('Punched OUT successfully!');
    }
  };

  const triggerToast = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const kpiCards = [
    { label: 'PRESENT TODAY', value: kpis.present, color: 'from-[#00b0ff] to-[#0091ea]', icon: FileText, desc: 'Active in office/remote' },
    { label: 'ABSENT TODAY', value: kpis.absent, color: 'from-[#ff5252] to-[#ff1744]', icon: Clock, desc: 'Unplanned/planned absentees' },
    { label: 'EARLY GOING', value: kpis.earlyGoing, color: 'from-[#00e676] to-[#00c853]', icon: FileCheck, desc: 'Left prior to checkout window' },
    { label: 'LATE ENTRY', value: kpis.lateEntry, color: 'from-[#1565c0] to-[#0d47a1]', icon: Users, desc: 'Clocked in after core hours' }
  ];

  return (
    <DashboardPage>
      {/* Toast Alert */}
      <AnimatePresence>{showNotification && <Toast key={showNotification}>{showNotification}</Toast>}</AnimatePresence>

      {/* Top row: 4 KPI Cards */}
      <Section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi, idx) => (
          <StatCard key={idx} icon={kpi.icon} label={kpi.label} value={kpi.value} hint={kpi.desc} tone={KPI_TONES[idx]} />
        ))}
      </Section>

      {/* Dynamic Action Section: Left: Interactive Punch Card, Right: Live Activity Log */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Interactive Punch In Widget */}
        <Panel
          title="Quick punch terminal"
          icon={Sparkles}
          tone="orange"
          badge={
            <Badge tone={activePunchState === 'in' ? 'emerald' : 'slate'} pulse={activePunchState === 'in'}>
              {activePunchState === 'in' ? 'Active: In' : 'Active: Out'}
            </Badge>
          }
        >
          <form onSubmit={handlePunch} className="flex h-full flex-col justify-between gap-5 p-5">
            <div className="space-y-4">
              <p className="text-[13.5px] leading-relaxed text-[#535768] dark:text-[#aab3c5]">
                Register your mock office entrance, late entry check-in, or early going sign-off directly inside the sandbox environment.
              </p>

              {activePunchState === 'out' && (
                <div>
                  <span className={fieldLabel}>Punch log type</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Present', 'Early Going', 'Late Entry'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPunchType(type)}
                        aria-pressed={punchType === type}
                        className={`h-10 rounded-full border px-2 text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                          punchType === type
                            ? 'border-[#da5427] bg-[#fbe6dd] dark:bg-[#da5427]/15 text-[#7a2e12] dark:text-[#f8d3c3] shadow-[0_6px_16px_-10px_rgba(218,84,39,0.8)]'
                            : 'border-[#e2e4ea] dark:border-[#2a3550] bg-white dark:bg-[#111a2e] text-[#323338] dark:text-[#d5dae4] hover:border-[#c9ccd6] dark:hover:border-[#3a4767] hover:bg-[#f6f7f9] dark:hover:bg-white/5'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="punch-note" className={fieldLabel}>Log memo / note</label>
                <input
                  id="punch-note"
                  type="text"
                  placeholder="e.g. Remote work log, Client meeting, Doctor visit"
                  value={punchNote}
                  onChange={(e) => setPunchNote(e.target.value)}
                  className={fieldInput}
                />
              </div>
            </div>

            <PrimaryButton loading={false} loadingText="" tone={activePunchState === 'out' ? 'brand' : 'dark'}>
              {activePunchState === 'out' ? 'Punch in now' : 'Punch out'}
            </PrimaryButton>
          </form>
        </Panel>

        {/* Live Attendance Activity Log */}
        <Panel
          title="Today's registered logs & feed"
          icon={Radio}
          tone="blue"
          className="lg:col-span-2"
          badge={<Badge tone="blue" pulse>Live stream</Badge>}
        >
          <ul className="max-h-[320px] divide-y divide-slate-100 dark:divide-white/10 overflow-y-auto px-2 py-2">
            <AnimatePresence initial={false}>
              {attendanceLogs.map((log) => (
                <motion.li
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar tone={logTone(log.type)}>{log.avatar}</Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{log.name}</p>
                      <p className="truncate text-[12.5px] text-[#535768] dark:text-[#aab3c5]">{log.status}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p className="text-[13px] font-medium tabular-nums text-[#1a1818] dark:text-[#f1f3f8]">{log.time}</p>
                      <p className="text-[12px] text-[#535768] dark:text-[#aab3c5]">Clock time</p>
                    </div>
                    <Badge tone={logTone(log.type)}>{log.type}</Badge>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Panel>
      </Section>

      {/* Middle row: Stats grids & Top Performers */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Top presenties (current month)" icon={UserCheck} tone="emerald">
          <RankTable nameHeader="Employee name" valueHeader="Present days" rows={topPresent} tone="emerald" formatValue={(count) => `${count} / 26`} />
        </Panel>
        <Panel title="Top absentees (unplanned)" icon={AlertTriangle} tone="rose">
          <RankTable nameHeader="Employee name" valueHeader="Absent count" rows={topAbsent} tone="rose" formatValue={(count) => `${count} days`} />
        </Panel>
        <Panel title="Top half days summary" icon={Hourglass} tone="sky">
          <RankTable nameHeader="Employee name" valueHeader="Half days" rows={topHalfDays} tone="sky" formatValue={(count) => `${count} Count`} />
        </Panel>
      </Section>

      {/* Bottom Row: Last 7 Days Summary with early going details */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Early going - last 7 days" icon={TimerOff} tone="amber">
          <RankTable nameHeader="Employee name" valueHeader="Occurrences" rows={earlyGoingList} tone="amber" formatValue={(count) => `${count} times`} />
        </Panel>

        {/* Corporate Attendance Insights */}
        <InsightCard className="min-h-[240px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-[#fde4d8]" />
              <span className="text-[12px] font-medium uppercase tracking-widest text-[#fde4d8]">System insight</span>
            </div>
            <h4 className="text-[20px] font-medium leading-snug tracking-[-0.01em]">Sandbox attendance terminal active</h4>
            <p className="text-[14px] leading-relaxed text-white/90">
              Daily logs are synced securely with the active enterprise corporate workspace. Use the quick punch log on the left to simulate live events. All counters instantly recalibrate to preserve system fidelity.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/15 pt-4 text-[13px]">
            <span className="flex items-center gap-2">
              Terminal status:
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                ONLINE
              </span>
            </span>
            <span className="text-white/90">Version: v2.4.1</span>
          </div>
        </InsightCard>
      </Section>
    </DashboardPage>
  );
}

// Present, absent, early going, late entry.
const KPI_TONES: Tone[] = ['emerald', 'rose', 'amber', 'blue'];

function logTone(type: AttendanceLog['type']): Tone {
  return type === 'Present' ? 'emerald' : type === 'Late Entry' ? 'blue' : 'amber';
}
