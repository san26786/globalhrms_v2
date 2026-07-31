"use client"
import React, { useState } from 'react';
import { FileText, Clock, FileCheck, Users, PlusCircle, Calendar, Send, ShieldAlert, Sparkles } from 'lucide-react';

interface LeaveRequest {
  id: string;
  name: string;
  type: string;
  from: string;
  to: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  reason: string;
}

export default function LeaveDashboard() {
  const [kpis, setKpis] = useState({
    paid: 12,
    unpaid: 2,
    sick: 4,
    lieu: 1
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    { id: '1', name: 'Sandeep Yadav', type: 'Paid Leave', from: '11/07/2026', to: '14/07/2026', status: 'Pending', reason: 'Family function back home' },
    { id: '2', name: 'Priya Sharma', type: 'Sick Leave', from: '10/07/2026', to: '11/07/2026', status: 'Approved', reason: 'High fever medical rest' },
    { id: '3', name: 'Rajesh Kumar', type: 'Lieu Days', from: '15/07/2026', to: '15/07/2026', status: 'Approved', reason: 'Compensatory off for weekend deployment' },
    { id: '4', name: 'Ananya Sen', type: 'Paid Leave', from: '18/07/2026', to: '22/07/2026', status: 'Approved', reason: 'Personal travel' }
  ]);

  const [formEmployee, setFormEmployee] = useState('You (DEMOadmin)');
  const [formType, setFormType] = useState('Paid Leave');
  const [formFrom, setFormFrom] = useState('2026-07-12');
  const [formTo, setFormTo] = useState('2026-07-15');
  const [formReason, setFormReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stats
  const topPaid = [
    { name: 'Ananya Sen', count: 18 },
    { name: 'Rajesh Kumar', count: 14 },
    { name: 'Priya Sharma', count: 12 },
    { name: 'Sandeep Yadav', count: 10 },
  ];

  const topUnpaid = [
    { name: 'Amit Patel', count: 4 },
    { name: 'Sandeep Yadav', count: 2 },
  ];

  const topSick = [
    { name: 'Priya Sharma', count: 5 },
    { name: 'Amit Patel', count: 3 },
    { name: 'Sandeep Yadav', count: 2 },
  ];

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Format dates
    const fromParts = formFrom.split('-');
    const toParts = formTo.split('-');
    const formattedFrom = fromParts.length === 3 ? `${fromParts[2]}/${fromParts[1]}/${fromParts[0]}` : formFrom;
    const formattedTo = toParts.length === 3 ? `${toParts[2]}/${toParts[1]}/${toParts[0]}` : formTo;

    const newRequest: LeaveRequest = {
      id: String(Date.now()),
      name: formEmployee,
      type: formType,
      from: formattedFrom,
      to: formattedTo,
      status: 'Pending',
      reason: formReason || 'General Personal Leave'
    };

    setLeaveRequests([newRequest, ...leaveRequests]);

    // Update KPI metrics
    setKpis(prev => {
      const next = { ...prev };
      if (formType === 'Paid Leave') next.paid += 1;
      if (formType === 'Unpaid Leave') next.unpaid += 1;
      if (formType === 'Sick Leave') next.sick += 1;
      if (formType === 'Lieu Days') next.lieu += 1;
      return next;
    });

    setFormReason('');
    triggerToast(`Leave request submitted successfully for ${formType}!`);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const kpiCards = [
    { label: 'PAID LEAVES', value: kpis.paid, color: 'from-[#00b0ff] to-[#0091ea]', icon: FileText, desc: 'Earned corporate leaves balance' },
    { label: 'UNPAID LEAVES', value: kpis.unpaid, color: 'from-[#ff5252] to-[#ff1744]', icon: Clock, desc: 'Loss of Pay (LOP) registers' },
    { label: 'SICK LEAVES', value: kpis.sick, color: 'from-[#00e676] to-[#00c853]', icon: FileCheck, desc: 'Medical emergency registers' },
    { label: 'LIEU DAYS', value: kpis.lieu, color: 'from-[#1565c0] to-[#0d47a1]', icon: Users, desc: 'Compensatory off (Comp-offs)' }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in font-sans">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-slide-up">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
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

      {/* Middle Interactive Grid Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Leave application panel */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Request Leave Terminal
            </h3>
          </div>

          <form onSubmit={handleApplyLeave} className="p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Apply for leave on behalf of employees or your admin account. System will update the metrics instantly.
              </p>

              {/* Employee name input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Employee Name</label>
                <input
                  type="text"
                  required
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                />
              </div>

              {/* Leave type dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Leave Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700 cursor-pointer"
                >
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Lieu Days">Lieu Days</option>
                </select>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">From</label>
                  <input
                    type="date"
                    required
                    value={formFrom}
                    onChange={(e) => setFormFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-xl outline-none font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">To</label>
                  <input
                    type="date"
                    required
                    value={formTo}
                    onChange={(e) => setFormTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-xl outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Reason input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Reason for absence</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vacation, Medical Checkup, Rest"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Request
            </button>
          </form>
        </div>

        {/* Live List: Tomorrow on Leave & Recent Requests */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[250px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Leave Requests & History Registry
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">ACTIVE SYSTEM</span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-start overflow-y-auto max-h-[330px] divide-y divide-slate-100">
            {leaveRequests.map((req) => (
              <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-all gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[11px] font-black text-blue-600">
                    {req.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 leading-none">{req.name}</h4>
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded">
                        {req.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block mt-1.5 italic">
                      "{req.reason}"
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5">
                  <div className="flex flex-col text-left sm:text-right leading-none">
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      {req.from} to {req.to}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium mt-1">Calendar Range</span>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                    req.status === 'Approved' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : req.status === 'Rejected' 
                      ? 'bg-rose-50 text-rose-600 border-rose-100' 
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Leaderboard stats for Leave counts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Paid leave leaderboard */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Paid Leaves Taken
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Leaves Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topPaid.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-slate-800 text-right font-mono">{row.count} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unpaid leaves taken */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Unpaid Leave registers
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Leaves Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topUnpaid.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-rose-600 text-right font-mono">{row.count} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sick leaves summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-[220px]">
          <div className="bg-slate-50/50 px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wider">
              Top Sick Leaves balance
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-start">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 text-left">Employee Name</th>
                  <th className="pb-2 text-right">Leaves Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topSick.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {row.name}
                    </td>
                    <td className="py-2.5 text-xs font-black text-emerald-600 text-right font-mono">{row.count} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
