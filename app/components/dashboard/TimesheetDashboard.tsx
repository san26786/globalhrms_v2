"use client"
import React, { useState } from 'react';
import { FileText, Clock, Calendar, CheckCircle2, AlertCircle, PlusCircle, ArrowUpRight, Check, Briefcase } from 'lucide-react';

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
  const [kpis, setKpis] = useState({
    approved: 42,
    pending: 8,
    rejected: 1,
    drafted: 3
  });

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

  const pieCards = [
    { title: 'Timesheet Today', percentage: 92, label: 'Submitted On Time', color: '#10b981', desc: '48 of 52 employees submitted' },
    { title: 'Timesheet Yesterday', percentage: 98, label: 'Submitted On Time', color: '#10b981', desc: '51 of 52 employees submitted' },
    { title: 'Timesheet Current Week', percentage: 86, label: 'Approved In Advance', color: '#3b82f6', desc: 'Core milestones fulfilled' },
    { title: 'Timesheet Last Week', percentage: 100, label: 'Completed All Logs', color: '#10b981', desc: 'All billing hours cleared' },
    { title: 'Timesheet Current Month', percentage: 95, label: 'Fidelity Validated', color: '#f59e0b', desc: 'Audit verified with corporate' }
  ];

  const kpiCards = [
    { label: 'TIMESHEETS APPROVED', value: kpis.approved, color: 'from-[#00b0ff] to-[#0091ea]', icon: CheckCircle2, desc: 'Locked and verified for payroll' },
    { label: 'TIMESHEETS PENDING', value: kpis.pending, color: 'from-[#1565c0] to-[#0d47a1]', icon: Clock, desc: 'Awaiting administrator audit' },
    { label: 'TIMESHEETS REJECTED', value: kpis.rejected, color: 'from-[#ff5252] to-[#ff1744]', icon: AlertCircle, desc: 'Requires employee correction' },
    { label: 'TIMESHEETS DRAFTED', value: kpis.drafted, color: 'from-[#00e676] to-[#00c853]', icon: FileText, desc: 'Saved progress in workspace' }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in font-sans">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-slide-up">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00b0ff] animate-ping" />
          <span className="text-xs font-bold">{toastMessage}</span>
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
              {/* Colored left container block (cyan style from screenshot) */}
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

      {/* Middle Grid Row: Interactive Time logger & live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive hours logger */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Log Hours Terminal
            </h3>
          </div>

          <form onSubmit={handleSubmitTime} className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3.5">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Log development or administrative tasks directly to project timesheets. Approved logs immediately compile into reports.
              </p>

              {/* Project select */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Project</label>
                <select
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700 cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Date & Hours row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Hours Worked</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    required
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Log Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-xl outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Task description */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Task Deliverables Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Developed landing page layout, set up env configs"
                  value={formTask}
                  onChange={(e) => setFormTask(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register Timesheet Log
            </button>
          </form>
        </div>

        {/* Live timesheet feed table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[250px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Recent Worklogs Registry
            </h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">Active Registry Logs</span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-start overflow-y-auto max-h-[330px] divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-all gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                    {log.employee.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 leading-none">{log.employee}</h4>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                        {log.project}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block mt-1.5 italic">
                      {log.task}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5">
                  <div className="flex flex-col text-left sm:text-right leading-none">
                    <span className="text-[11px] font-black text-slate-800 font-mono">
                      {log.hours} Hrs
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium mt-1">{log.date}</span>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                    log.status === 'Approved' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : log.status === 'Draft' 
                      ? 'bg-slate-100 text-slate-500 border-slate-200' 
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Pie cards grid - highly optimized design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pieCards.slice(0, 3).map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col items-center">
            <div className="w-full bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 text-center">
              <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
                {card.title}
              </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col items-center justify-center">
              {/* SVG Ring represent percentages */}
              <div className="relative w-36 h-36 select-none flex items-center justify-center">
                <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke={card.color}
                    strokeWidth="10"
                    strokeDasharray="238.76"
                    strokeDashoffset={(238.76 - (238.76 * card.percentage) / 100).toFixed(2)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800">
                    {card.percentage}%
                  </span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Submitted</span>
                </div>
              </div>

              {/* Legend label */}
              <div className="mt-4 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  <span>{card.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{card.desc}</span>
              </div>
            </div>
          </div>
        ))}

        {pieCards.slice(3).map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col items-center">
            <div className="w-full bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 text-center">
              <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
                {card.title}
              </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col items-center justify-center">
              {/* SVG Ring represent percentages */}
              <div className="relative w-36 h-36 select-none flex items-center justify-center">
                <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke={card.color}
                    strokeWidth="10"
                    strokeDasharray="238.76"
                    strokeDashoffset={(238.76 - (238.76 * card.percentage) / 100).toFixed(2)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800">
                    {card.percentage}%
                  </span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Submitted</span>
                </div>
              </div>

              {/* Legend label */}
              <div className="mt-4 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  <span>{card.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{card.desc}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Audit validation helper */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 flex flex-col justify-between min-h-[260px]">
          <div className="space-y-3.5">
            <span className="text-[9px] font-black text-blue-600 tracking-widest uppercase bg-blue-50 px-2 py-0.5 rounded-md inline-block">Enterprise Audit</span>
            <h4 className="text-sm font-black text-slate-800">Audit Status: VALIDATED</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Enterprise timesheets have been matched against corporate work scopes and clock parameters successfully. All metrics are calibrated to support multi-regional billing cycles with the active brand profile.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-400 uppercase">
            <span>Audit cycle: 2026-Q3</span>
            <span className="text-emerald-500 font-black">CLEARED</span>
          </div>
        </div>

      </div>

    </div>
  );
}
