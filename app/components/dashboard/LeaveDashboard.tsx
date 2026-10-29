"use client"
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Clock, FileCheck, Users, CalendarPlus, ClipboardList, Wallet, CalendarX, HeartPulse } from 'lucide-react';
import { LeaveDashboardData } from '@/lib/dashboard/types';
import { PrimaryButton } from '@/components/auth/AuthUi';
import { Avatar, Badge, DashboardPage, Panel, RankTable, Section, StatCard, Toast, fieldInput, fieldLabel, type Tone } from './DashboardUi';

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
  const [dashboardData, setDashboardData] = useState<LeaveDashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/leave');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load leave data');
        if (!cancelled) setDashboardData(json.data as LeaveDashboardData);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [kpis, setKpis] = useState({
    paid: 12,
    unpaid: 2,
    sick: 4,
    lieu: 1
  });

  // Sync KPI tiles once real data arrives. The "Apply Leave" form below still
  // adjusts this same local state optimistically for its own mock submissions
  // — see the Phase 16 README for the note on why the request feed itself
  // (as opposed to the KPI/leaderboard widgets) isn't wired to a query.
  useEffect(() => {
    if (dashboardData) {
      setKpis({
        paid: dashboardData.kpis.paidToday,
        unpaid: dashboardData.kpis.unpaidToday,
        sick: dashboardData.kpis.sickToday,
        lieu: dashboardData.kpis.lieuToday,
      });
    }
  }, [dashboardData]);

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

  // Stats — populated from /api/dashboard/leave; fall back to the original
  // mock rows while the request is in flight so the layout never pops empty.
  const topPaid = dashboardData?.topPaid.length
    ? dashboardData.topPaid
    : [
        { name: 'Ananya Sen', count: 18 },
        { name: 'Rajesh Kumar', count: 14 },
        { name: 'Priya Sharma', count: 12 },
        { name: 'Sandeep Yadav', count: 10 },
      ];

  const topUnpaid = dashboardData?.topUnpaid.length
    ? dashboardData.topUnpaid
    : [
        { name: 'Amit Patel', count: 4 },
        { name: 'Sandeep Yadav', count: 2 },
      ];

  const topSick = dashboardData?.topSick.length
    ? dashboardData.topSick
    : [
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
    <DashboardPage>
      {/* Toast Alert */}
      <AnimatePresence>{toastMessage && <Toast key={toastMessage}>{toastMessage}</Toast>}</AnimatePresence>

      {/* Top row: 4 KPI Cards */}
      <Section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi, idx) => (
          <StatCard key={idx} icon={kpi.icon} label={kpi.label} value={kpi.value} hint={kpi.desc} tone={KPI_TONES[idx]} />
        ))}
      </Section>

      {/* Middle Interactive Grid Row */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leave application panel */}
        <Panel title="Request leave terminal" icon={CalendarPlus} tone="orange">
          <form onSubmit={handleApplyLeave} className="flex h-full flex-col justify-between gap-5 p-5">
            <div className="space-y-4">
              <p className="text-[13.5px] leading-relaxed text-[#535768] dark:text-[#aab3c5]">
                Apply for leave on behalf of employees or your admin account. System will update the metrics instantly.
              </p>

              {/* Employee name input */}
              <div>
                <label htmlFor="leave-employee" className={fieldLabel}>Employee name</label>
                <input
                  id="leave-employee"
                  type="text"
                  required
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className={fieldInput}
                />
              </div>

              {/* Leave type dropdown */}
              <div>
                <label htmlFor="leave-type" className={fieldLabel}>Leave type</label>
                <select
                  id="leave-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className={`${fieldInput} cursor-pointer`}
                >
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Lieu Days">Lieu Days</option>
                </select>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="leave-from" className={fieldLabel}>From</label>
                  <input
                    id="leave-from"
                    type="date"
                    required
                    value={formFrom}
                    onChange={(e) => setFormFrom(e.target.value)}
                    className={fieldInput}
                  />
                </div>
                <div>
                  <label htmlFor="leave-to" className={fieldLabel}>To</label>
                  <input
                    id="leave-to"
                    type="date"
                    required
                    value={formTo}
                    onChange={(e) => setFormTo(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>

              {/* Reason input */}
              <div>
                <label htmlFor="leave-reason" className={fieldLabel}>Reason for absence</label>
                <input
                  id="leave-reason"
                  type="text"
                  required
                  placeholder="e.g. Vacation, Medical Checkup, Rest"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className={fieldInput}
                />
              </div>
            </div>

            <PrimaryButton loading={false} loadingText="">
              Submit request
            </PrimaryButton>
          </form>
        </Panel>

        {/* Live List: Tomorrow on Leave & Recent Requests */}
        <Panel
          title="Leave requests & history registry"
          icon={ClipboardList}
          tone="blue"
          className="lg:col-span-2"
          badge={<Badge tone="emerald" pulse>Active system</Badge>}
        >
          <ul className="max-h-[440px] divide-y divide-slate-100 dark:divide-white/10 overflow-y-auto px-2 py-2">
            <AnimatePresence initial={false}>
              {leaveRequests.map((req) => (
                <motion.li
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col justify-between gap-3 rounded-xl px-3 py-3.5 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar tone="blue">{req.name.charAt(0)}</Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{req.name}</p>
                        <span className="rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[12px] font-medium text-slate-700 dark:text-slate-200">{req.type}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] italic text-[#535768] dark:text-[#aab3c5]">&ldquo;{req.reason}&rdquo;</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-[13px] font-medium tabular-nums text-[#1a1818] dark:text-[#f1f3f8]">
                        {req.from} to {req.to}
                      </p>
                      <p className="text-[12px] text-[#535768] dark:text-[#aab3c5]">Calendar range</p>
                    </div>
                    <Badge tone={req.status === 'Approved' ? 'emerald' : req.status === 'Rejected' ? 'rose' : 'amber'}>{req.status}</Badge>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Panel>
      </Section>

      {/* Leaderboard stats for Leave counts */}
      <Section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Top paid leaves taken" icon={Wallet} tone="blue">
          <RankTable nameHeader="Employee name" valueHeader="Leaves count" rows={topPaid} tone="blue" formatValue={(count) => `${count} Days`} />
        </Panel>
        <Panel title="Top unpaid leave registers" icon={CalendarX} tone="rose">
          <RankTable nameHeader="Employee name" valueHeader="Leaves count" rows={topUnpaid} tone="rose" formatValue={(count) => `${count} Days`} />
        </Panel>
        <Panel title="Top sick leaves balance" icon={HeartPulse} tone="emerald">
          <RankTable nameHeader="Employee name" valueHeader="Leaves count" rows={topSick} tone="emerald" formatValue={(count) => `${count} Days`} />
        </Panel>
      </Section>
    </DashboardPage>
  );
}

// Paid, unpaid, sick, lieu days.
const KPI_TONES: Tone[] = ['blue', 'rose', 'emerald', 'amber'];
