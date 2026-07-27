import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Database, 
  Trash2, 
  Download, 
  RefreshCw, 
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface SubModuleViewerProps {
  moduleName: string;
  subModuleName: string;
  activeBrand: string;
}

interface RecordItem {
  id: string;
  title: string;
  category: string;
  status: 'Approved' | 'Pending' | 'Draft' | 'Active';
  date: string;
  user: string;
  details: Record<string, string>;
}

export default function SubModuleViewer({ moduleName, subModuleName, activeBrand }: SubModuleViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUser, setNewUser] = useState('DEMOadmin');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Generate realistic seed-based initial records based on the sub-module name
  useEffect(() => {
    const defaultFields = getCustomFieldsForSubModule(subModuleName);
    setCustomFields(defaultFields);

    const initialTitles = getSampleTitlesForSubModule(subModuleName);
    const statuses: Array<'Approved' | 'Pending' | 'Draft' | 'Active'> = ['Approved', 'Pending', 'Draft', 'Active'];
    
    const seededRecords: RecordItem[] = initialTitles.map((title, index) => {
      const fieldData: Record<string, string> = {};
      defaultFields.forEach(f => {
        fieldData[f.key] = f.value + (index + 1);
      });

      return {
        id: `REC-${1000 + index}`,
        title,
        category: subModuleName,
        status: statuses[index % statuses.length],
        date: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user: index % 2 === 0 ? 'DEMOadmin' : 'System Automator',
        details: fieldData
      };
    });

    setRecords(seededRecords);
    setSearchQuery('');
    setStatusFilter('All');
    setShowAddForm(false);
    setNewTitle('');
  }, [subModuleName]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1000);
  };

  const handleDelete = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const fieldData: Record<string, string> = {};
    customFields.forEach(f => {
      fieldData[f.key] = f.value;
    });

    const newRec: RecordItem = {
      id: `REC-${1000 + records.length + 1}`,
      title: newTitle,
      category: subModuleName,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      user: newUser || 'DEMOadmin',
      details: fieldData
    };

    setRecords([newRec, ...records]);
    setNewTitle('');
    setShowAddForm(false);
  };

  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.user.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Dynamic label generator
  function getCustomFieldsForSubModule(subName: string) {
    if (subName.toLowerCase().includes('bank') || subName.toLowerCase().includes('account')) {
      return [
        { key: 'Account Number', value: 'GB-9827-34E7-' },
        { key: 'BIC/SWIFT', value: 'GLHRGB2L' },
        { key: 'Routing Code', value: '40-11-20' },
      ];
    }
    if (subName.toLowerCase().includes('address') || subName.toLowerCase().includes('location')) {
      return [
        { key: 'Street Line', value: 'Corporate Tech Park, Block ' },
        { key: 'Postal Code', value: 'EC1A ' },
        { key: 'City', value: 'London' },
      ];
    }
    if (subName.toLowerCase().includes('salary') || subName.toLowerCase().includes('pay')) {
      return [
        { key: 'Base Pay Rate', value: '£4,500' },
        { key: 'Tax Code', value: '1257L' },
        { key: 'Disbursal Mode', value: 'FPS Direct' },
      ];
    }
    if (subName.toLowerCase().includes('leave') || subName.toLowerCase().includes('attendance')) {
      return [
        { key: 'Entitlement Ref', value: 'L-2026-' },
        { key: 'Authorized By', value: 'HR Lead' },
        { key: 'Shift Schedule', value: 'General Standard' },
      ];
    }
    return [
      { key: 'Reference Node', value: 'CNS-NODE-0' },
      { key: 'Sync Timestamp', value: 'Auto Triggered' },
      { key: 'Enterprise Priority', value: 'Standard Tier' }
    ];
  }

  function getSampleTitlesForSubModule(subName: string) {
    if (subName.toLowerCase().includes('bank') || subName.toLowerCase().includes('account')) {
      return ['Main Corporate Reserve', 'Payroll Disbursal Fund', 'VAT Settlement Vault', 'Tax Retainer Escrow'];
    }
    if (subName.toLowerCase().includes('address') || subName.toLowerCase().includes('location')) {
      return ['Primary Headquarters (UK)', 'Operational Branch (India)', 'Tech Hub (Singapore)', 'Disaster Recovery Office'];
    }
    if (subName.toLowerCase().includes('salary') || subName.toLowerCase().includes('pay')) {
      return ['Q3 Compensation Matrix', 'Executive Pay Grid', 'Contractor Retainer Rates', 'Shift Premium Rates'];
    }
    if (subName.toLowerCase().includes('leave') || subName.toLowerCase().includes('attendance')) {
      return ['Standard Paid Time Off PTO', 'Corporate Compassionate Leave', 'Medical Health Quarantine Allowance', 'Adhoc Emergency Absences'];
    }
    return [
      `${subName} Entry Registry Alpha`,
      `${subName} Master Reference Beta`,
      `${subName} Configuration Schema Gamma`,
      `${subName} Audit Log Delta`
    ];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1 sm:p-4 font-sans text-slate-600">
      
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold tracking-wide uppercase select-none">
            <span>{moduleName}</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="text-blue-600">{subModuleName}</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500 shrink-0" />
            {subModuleName} Registry
          </h2>
          <p className="text-xs text-slate-400 font-semibold max-w-xl">
            Live workspace environment loaded under <span className="text-slate-700 font-bold">{activeBrand}</span>. Connected to enterprise database nodes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
              isSyncing ? 'animate-pulse' : ''
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Node'}
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-100 hover:shadow-lg transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New Entry
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
            <Database className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Records</span>
            <span className="text-base font-black text-slate-800 leading-none mt-1 block">{records.length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Approved</span>
            <span className="text-base font-black text-slate-800 leading-none mt-1 block">
              {records.filter(r => r.status === 'Approved' || r.status === 'Active').length}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
            <Clock className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pending</span>
            <span className="text-base font-black text-slate-800 leading-none mt-1 block">
              {records.filter(r => r.status === 'Pending').length}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 col-span-2 lg:col-span-1">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
            <Sparkles className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sub-Module Node</span>
            <span className="text-xs font-bold text-slate-700 leading-none mt-1 block truncate max-w-[120px]">{subModuleName.slice(0, 16)}</span>
          </div>
        </div>
      </div>

      {/* Add Entry interactive form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl max-w-2xl mx-auto"
          >
            <h3 className="font-display font-black text-slate-800 text-sm mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-4 h-4 text-blue-500" />
              Add New {subModuleName} Record
            </h3>
            
            <form onSubmit={handleAddRecord} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Record Label / Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Primary Compensation Tier"
                    className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Authorized By User</label>
                  <input
                    type="text"
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder="DEMOadmin"
                    className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Dynamic Field Preview */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">System Injected Attributes</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="bg-white px-3 py-2 rounded-lg border border-slate-100/80">
                      <span className="text-[9px] font-bold text-slate-400 uppercase leading-none block">{field.key}</span>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => {
                          const updated = [...customFields];
                          updated[idx].value = e.target.value;
                          setCustomFields(updated);
                        }}
                        className="text-xs font-black text-slate-700 w-full outline-none border-b border-transparent focus:border-slate-200 mt-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-100 transition-all active:scale-95"
                >
                  Submit Record
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 stroke-[2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${subModuleName} database logs...`}
            className="w-full bg-[#f8fafc] border border-slate-200/80 text-xs text-slate-700 pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100/50 transition-all placeholder:text-slate-400 font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-slate-500 text-[10px] font-black uppercase tracking-wider select-none">
            <Filter className="w-3 h-3 text-slate-400" />
            Filter
          </div>
          
          <div className="flex gap-1.5 bg-slate-100/50 p-1 rounded-xl">
            {['All', 'Approved', 'Pending', 'Draft'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                  statusFilter === status
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Records Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]/50 text-[10px] font-black text-slate-400 uppercase tracking-widest select-none">
                <th className="px-6 py-4.5">ID Node</th>
                <th className="px-6 py-4.5">Record Title / Description</th>
                {customFields.slice(0, 2).map((cf) => (
                  <th key={cf.key} className="px-6 py-4.5 hidden md:table-cell">{cf.key}</th>
                ))}
                <th className="px-6 py-4.5">Authorized By</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-semibold">
                    <Database className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    No active record logs matched your query.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-black text-blue-600 bg-blue-50/50 px-2 py-1 rounded">
                          {rec.id}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="font-bold text-slate-800 text-xs sm:text-sm">
                          {rec.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Date Logged: {rec.date}
                        </div>
                      </td>
                      {customFields.slice(0, 2).map((cf) => (
                        <td key={cf.key} className="px-6 py-4.5 whitespace-nowrap text-xs text-slate-600 font-bold hidden md:table-cell">
                          {rec.details[cf.key] || 'N/A'}
                        </td>
                      ))}
                      <td className="px-6 py-4.5 whitespace-nowrap text-xs text-slate-700 font-bold">
                        {rec.user}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1.5 ${
                          rec.status === 'Approved' || rec.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : rec.status === 'Pending'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                              : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            rec.status === 'Approved' || rec.status === 'Active'
                              ? 'bg-emerald-500'
                              : rec.status === 'Pending'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                          }`} />
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleDelete(rec.id)}
                            className="p-1.5 bg-slate-50 border border-slate-150 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50/50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Purge Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50/40 px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-bold select-none gap-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Active Sync Protocol: WebSocket Live Node
          </span>
          <span>
            Records showing: {filteredRecords.length} / {records.length}
          </span>
        </div>
      </div>
    </div>
  );
}
