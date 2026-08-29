"use client"
import React, { useEffect, useState } from 'react';
import { FileText, Clock, FileCheck, Users, Play, ArrowRight, CheckCircle2, UserCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { AttendanceDashboardData } from '@/lib/dashboard/types';

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
        const res = await fetch('/api/dashboard/attendance');
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in font-sans">
      
      {/* Toast Alert */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-slide-up">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold">{showNotification}</span>
        </div>
      )}

      {/* Top row: 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((kpi, idx) => {
          const IconComponent = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl shadow-sm border border-slate-150 overflow-hidden flex items-stretch h-24 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              {/* Colored left container block */}
              <div className={`bg-gradient-to-br ${kpi.color} w-20 flex items-center justify-center shrink-0`}>
                <IconComponent className="w-8 h-8 text-white stroke-[1.5] group-hover:scale-110 transition-transform" />
              </div>
              
              {/* Value and Label on the right */}
              <div className="flex-1 p-4 flex flex-col justify-center text-left pl-5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {kpi.label}
                </span>
                <span className="text-2xl font-black text-slate-800 mt-1 font-sans leading-none">
                  {kpi.value}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 font-medium truncate max-w-[150px]">
                  {kpi.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Action Section: Left: Interactive Punch Card, Right: Live Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Punch In Widget */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
                Quick Punch Terminal
              </h3>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
              activePunchState === 'in' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' : 'bg-slate-100 text-slate-500'
            }`}>
              {activePunchState === 'in' ? 'ACTIVE: IN' : 'ACTIVE: OUT'}
            </span>
          </div>

          <form onSubmit={handlePunch} className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Register your mock office entrance, late entry check-in, or early going sign-off directly inside the sandbox environment.
              </p>

              {activePunchState === 'out' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Punch Log Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Present', 'Early Going', 'Late Entry'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPunchType(type)}
                        className={`py-1.5 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                          punchType === type 
                            ? 'bg-blue-50 text-blue-600 border-blue-400' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Log Memo / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Remote work log, Client meeting, Doctor visit"
                  value={punchNote}
                  onChange={(e) => setPunchNote(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
                activePunchState === 'out' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100' 
                  : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100'
              }`}
            >
              {activePunchState === 'out' ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Punch In Now
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Punch Out
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Attendance Activity Log */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[250px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Todays Registered Logs & Feed
            </h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Live Stream</span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-start overflow-y-auto max-h-[220px] divide-y divide-slate-100">
            {attendanceLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                    {log.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 leading-none">{log.name}</h4>
                    <span className="text-[9px] text-slate-400 font-medium block mt-1">{log.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[10px] font-bold text-slate-500">{log.time}</span>
                    <span className="text-[9px] text-slate-400 font-medium block mt-1">Clock Time</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md border ${
                    log.type === 'Present' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : log.type === 'Late Entry' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {log.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Middle row: Stats grids & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Present leaderboard */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[240px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Presenties (Current Month)
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Present Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topPresent.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {row.name}
                    </td>
                    <td className="py-2 text-xs font-black text-slate-800 text-right font-mono">{row.count} / 26</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Absentee records */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[240px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Absentees (Unplanned)
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Absent Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topAbsent.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-rose-600 text-right font-mono">{row.count} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Half days list */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[240px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Half Days Summary
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Half Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topHalfDays.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-amber-600 text-right font-mono">{row.count} Count</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Bottom Row: Last 7 Days Summary with early going details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Early leaving list */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[240px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Early Going - Last 7 Days
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Occurrences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {earlyGoingList.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-emerald-600 text-right font-mono">{row.count} times</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Corporate Attendance Insights */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 flex flex-col justify-between min-h-[240px]">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-blue-600 tracking-widest uppercase">System Insight</span>
            </div>
            <h4 className="text-sm font-black text-slate-800">Sandbox Attendance Terminal active</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Daily logs are synced securely with the active enterprise corporate workspace. Use the quick punch log on the left to simulate live events. All counters instantly recalibrate to preserve system fidelity.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Terminal status: <span className="text-emerald-500">ONLINE</span></span>
            <span>Version: v2.4.1</span>
          </div>
        </div>

      </div>

    </div>
  );
}
