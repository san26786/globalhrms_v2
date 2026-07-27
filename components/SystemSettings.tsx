import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  ShieldCheck,
  Layers,
  Globe,
  BookOpen,
  History,
  Sliders,
  LogIn,
  Info,
  CheckCircle,
  HelpCircle,
  Clock,
  UserCheck,
  Building,
  Briefcase,
  AlertTriangle
} from 'lucide-react';

interface SystemSettingsProps {
  activeSubMenu?: string;
  activeBrand: string;
}

type SectionType = 
  | 'user-roles' 
  | 'dept-hierarchy' 
  | 'regional-settings' 
  | 'system-glossary' 
  | 'system-settings' 
  | 'login-audit';

interface SectionItem {
  id: SectionType;
  name: string;
  description: string;
  icon: any;
  category: 'Access Control' | 'Organization' | 'System Data';
}

export default function SystemSettings({ activeSubMenu, activeBrand }: SystemSettingsProps) {
  // Current active section
  const [activeSection, setActiveSection] = useState<SectionType>('user-roles');
  const [sectionSearch, setSectionSearch] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubMenu) {
      const sub = activeSubMenu.toLowerCase();
      if (sub.includes('role')) {
        setActiveSection('user-roles');
      } else if (sub.includes('hier') || sub.includes('dept') || sub.includes('depart')) {
        setActiveSection('dept-hierarchy');
      } else if (sub.includes('region') || sub.includes('locale') || sub.includes('country') || sub.includes('timezone')) {
        setActiveSection('regional-settings');
      } else if (sub.includes('glossary')) {
        setActiveSection('system-glossary');
      } else if (sub.includes('audit') || sub.includes('login') || sub.includes('last login')) {
        setActiveSection('login-audit');
      } else if (sub.includes('setting') || sub.includes('details')) {
        setActiveSection('system-settings');
      }
    }
  }, [activeSubMenu]);

  // Success Toast Helper
  const triggerToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Section definitions
  const sections: SectionItem[] = [
    {
      id: 'user-roles',
      name: 'User Roles & Permissions',
      description: 'Manage security access levels and feature permission matrices',
      icon: ShieldCheck,
      category: 'Access Control'
    },
    {
      id: 'dept-hierarchy',
      name: 'Department Hierarchy',
      description: 'Visualize and structure reporting lines of organization departments',
      icon: Layers,
      category: 'Organization'
    },
    {
      id: 'regional-settings',
      name: 'Regional Settings',
      description: 'Configure localized timezones, currencies, and date formats',
      icon: Globe,
      category: 'Organization'
    },
    {
      id: 'system-settings',
      name: 'Global System Settings',
      description: 'Fine-tune core security, session logs, and system variables',
      icon: Sliders,
      category: 'Access Control'
    },
    {
      id: 'system-glossary',
      name: 'System Glossary Codes',
      description: 'Edit dictionary definitions and common key-value master codes',
      icon: BookOpen,
      category: 'System Data'
    },
    {
      id: 'login-audit',
      name: 'User Login Audit Logs',
      description: 'Track real-time security events, IP locations, and session status',
      icon: LogIn,
      category: 'System Data'
    }
  ];

  // Filter sections by search query
  const filteredSections = sections.filter(sec =>
    sec.name.toLowerCase().includes(sectionSearch.toLowerCase()) ||
    sec.description.toLowerCase().includes(sectionSearch.toLowerCase()) ||
    sec.category.toLowerCase().includes(sectionSearch.toLowerCase())
  );

  // Mock States for User Roles
  const [roles, setRoles] = useState([
    { id: '1', name: 'System Administrator', usersCount: 2, permissions: { read: true, write: true, delete: true, export: true } },
    { id: '2', name: 'HR Manager', usersCount: 5, permissions: { read: true, write: true, delete: false, export: true } },
    { id: '3', name: 'Accountant', usersCount: 3, permissions: { read: true, write: true, delete: false, export: false } },
    { id: '4', name: 'Standard Supervisor', usersCount: 14, permissions: { read: true, write: true, delete: false, export: false } },
    { id: '5', name: 'General Employee', usersCount: 128, permissions: { read: true, write: false, delete: false, export: false } },
  ]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const togglePermission = (roleId: string, perm: 'read' | 'write' | 'delete' | 'export') => {
    setRoles(roles.map(r => {
      if (r.id === roleId) {
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [perm]: !r.permissions[perm]
          }
        };
      }
      return r;
    }));
    triggerToast('Role permission matrix updated successfully.');
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const newRole = {
      id: String(roles.length + 1),
      name: newRoleName,
      usersCount: 0,
      permissions: { read: true, write: false, delete: false, export: false }
    };
    setRoles([...roles, newRole]);
    setNewRoleName('');
    setShowRoleModal(false);
    triggerToast(`Added new security role: ${newRoleName}`);
  };

  const handleDeleteRole = (id: string, name: string) => {
    setRoles(roles.filter(r => r.id !== id));
    triggerToast(`Removed security role: ${name}`);
  };

  // Mock States for Department Hierarchy
  const [departments, setDepartments] = useState([
    { id: '101', name: 'Executive Board', parent: 'None', manager: 'Sarah Jenkins', code: 'EXEC' },
    { id: '102', name: 'Operations & Tech', parent: 'Executive Board', manager: 'David Chen', code: 'OPS' },
    { id: '103', name: 'Engineering', parent: 'Operations & Tech', manager: 'Marcus Vance', code: 'ENG' },
    { id: '104', name: 'Product Management', parent: 'Operations & Tech', manager: 'Linda Ross', code: 'PROD' },
    { id: '105', name: 'HR & Administration', parent: 'Executive Board', manager: 'Chanchal Singh', code: 'HRAD' },
    { id: '106', name: 'Global Finance', parent: 'Executive Board', manager: 'Arthur Pendelton', code: 'FIN' },
  ]);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptParent, setNewDeptParent] = useState('Executive Board');
  const [newDeptManager, setNewDeptManager] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim()) return;
    const newDept = {
      id: String(100 + departments.length + 1),
      name: newDeptName,
      parent: newDeptParent,
      manager: newDeptManager || 'Unassigned',
      code: newDeptCode.toUpperCase()
    };
    setDepartments([...departments, newDept]);
    setNewDeptName('');
    setNewDeptCode('');
    setNewDeptManager('');
    setShowDeptForm(false);
    triggerToast(`Department node "${newDeptName}" linked in hierarchy.`);
  };

  const handleDeleteDept = (id: string, name: string) => {
    setDepartments(departments.filter(d => d.id !== id));
    triggerToast(`Removed department node: ${name}`);
  };

  // Mock States for Regional Settings
  const [regionConfig, setRegionConfig] = useState({
    country: 'United Kingdom',
    timezone: 'GMT+1 (BST)',
    currency: 'GBP (£)',
    dateFormat: 'DD/MM/YYYY',
    language: 'English (UK)',
    dstEnpatched: true,
    multiCurrency: true,
    financialYearStart: '01 April'
  });
  const [isSavingRegion, setIsSavingRegion] = useState(false);

  const handleSaveRegion = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRegion(true);
    setTimeout(() => {
      setIsSavingRegion(false);
      triggerToast('Regional localization parameters saved and broadcasted to active instances.');
    }, 1200);
  };

  // Mock States for Global System Settings
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    lockoutAttempts: 5,
    sessionTimeout: 30, // minutes
    passwordPolicy: {
      minChars: 8,
      requireSpecial: true,
      requireNumber: true,
      requireCapital: true
    },
    websocketSync: true,
    securityLogs: true
  });
  const [isSavingSys, setIsSavingSys] = useState(false);

  const handleSaveSystem = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSys(true);
    setTimeout(() => {
      setIsSavingSys(false);
      triggerToast('Global system rules and security variables updated.');
    }, 1000);
  };

  // Mock States for System Glossary Codes
  const [glossaryTerms, setGlossaryCodes] = useState([
    { code: 'SYS_MSG_001', meaning: 'Session Expired', description: 'Triggered when persistent auth token loses validity', type: 'Error Log' },
    { code: 'SYS_MSG_002', meaning: 'Attendance Cleared', description: 'Successful mass punch compilation cron result', type: 'Info Notification' },
    { code: 'SYS_MSG_003', meaning: 'DB_SYNC_OK', description: 'Liveness response from Cloud Spanner PostgreSQL bridge', type: 'Database Log' },
    { code: 'SYS_MSG_004', meaning: 'REG_ERR_DUP_EMAIL', description: 'Duplicated user registration email verification lock', type: 'Validation Warning' },
    { code: 'SYS_MSG_005', meaning: 'AUTH_GATEWAY_PING', description: 'OAuth2 verification packet handshake response', type: 'Security Log' }
  ]);
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [newGlossaryCode, setNewGlossaryCode] = useState('');
  const [newGlossaryMeaning, setNewGlossaryMeaning] = useState('');
  const [newGlossaryDesc, setNewGlossaryDesc] = useState('');
  const [newGlossaryType, setNewGlossaryType] = useState('Info Notification');

  const handleAddGlossary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGlossaryCode.trim() || !newGlossaryMeaning.trim()) return;
    const newItem = {
      code: newGlossaryCode.toUpperCase().replace(/\s+/g, '_'),
      meaning: newGlossaryMeaning,
      description: newGlossaryDesc || 'N/A',
      type: newGlossaryType
    };
    setGlossaryCodes([...glossaryTerms, newItem]);
    setNewGlossaryCode('');
    setNewGlossaryMeaning('');
    setNewGlossaryDesc('');
    setShowGlossaryForm(false);
    triggerToast(`Added glossary dictionary key: ${newItem.code}`);
  };

  const handleDeleteGlossary = (code: string) => {
    setGlossaryCodes(glossaryTerms.filter(g => g.code !== code));
    triggerToast(`Removed glossary key: ${code}`);
  };

  // User Login Audit logs
  const [auditLogs] = useState([
    { user: 'singhchanchal783@gmail.com', time: '2026-07-14 06:12:45', ip: '103.112.44.89', location: 'London, UK', status: 'Success', device: 'Chrome / Windows 11' },
    { user: 'singhchanchal783@gmail.com', time: '2026-07-14 05:44:11', ip: '103.112.44.89', location: 'London, UK', status: 'Success', device: 'Chrome / Windows 11' },
    { user: 'unauthorized_attacker@net.io', time: '2026-07-14 04:32:00', ip: '198.51.100.12', location: 'Beijing, CN', status: 'Failed', device: 'Python-requests / Linux' },
    { user: 'admin_security@globalhr.com', time: '2026-07-13 23:15:30', ip: '82.165.110.22', location: 'Birmingham, UK', status: 'Success', device: 'Safari / macOS Sonoma' },
    { user: 'hr_manager_delhi@globalhr.com', time: '2026-07-13 18:44:09', ip: '122.160.88.102', location: 'New Delhi, IN', status: 'Success', device: 'Edge / Windows 11' },
    { user: 'guest_observer@tempmail.org', time: '2026-07-13 15:10:00', ip: '45.220.10.19', location: 'Dublin, IE', status: 'Failed', device: 'Firefox / Linux' },
  ]);
  const [auditSearch, setAuditSearch] = useState('');

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-600">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"
          >
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">System Admin Panel</span>
              <span className="text-[11px] font-bold text-slate-200 block mt-0.5">{successToast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container: Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: SystemSettings Sidebar (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">System Settings Submodule</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 leading-normal">
              Manage organization rules, departments, localization, dictionary master data and audit logs for <span className="text-slate-700">{activeBrand}</span>.
            </p>
          </div>

          {/* Search Box to Filter Sidebar Sections */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search configuration sections..."
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              className="w-full bg-[#f8fafc] border border-slate-200 text-[11px] text-slate-700 pl-9.5 pr-4 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-semibold placeholder:text-slate-400"
            />
          </div>

          {/* Configuration Sections List */}
          <div className="space-y-1.5 pt-2">
            {filteredSections.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                No sections matched "{sectionSearch}"
              </div>
            ) : (
              filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isSelected = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full flex items-start gap-3.5 p-3 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isSelected ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Icon className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                        {sec.name}
                      </div>
                      <div className={`text-[9.5px] leading-tight mt-1 font-semibold ${isSelected ? 'text-slate-100/80' : 'text-slate-400'}`}>
                        {sec.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Configuration Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SECTION 1: USER ROLES & PERMISSIONS */}
          {activeSection === 'user-roles' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4.5">
                <div>
                  <h3 className="text-base font-black text-slate-800">Security Roles & Permissions</h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Configure structural access criteria across modules.</p>
                </div>
                <button
                  onClick={() => setShowRoleModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all"
                >
                  <Plus className="w-4.5 h-4.5" />
                  Add Security Role
                </button>
              </div>

              {/* Roles Table List */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Role Security Title</th>
                      <th className="px-5 py-3 text-center">Active Users</th>
                      <th className="px-5 py-3 text-center">Read</th>
                      <th className="px-5 py-3 text-center">Write</th>
                      <th className="px-5 py-3 text-center">Delete</th>
                      <th className="px-5 py-3 text-center">Export</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {roles.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm block">{r.name}</span>
                          <span className="text-[9.5px] text-slate-400 font-bold mt-0.5 block">ROLE-ID: {r.id}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-xs text-slate-600">{r.usersCount}</td>
                        
                        {/* Checkbox columns */}
                        {['read', 'write', 'delete', 'export'].map((perm) => {
                          const pKey = perm as 'read' | 'write' | 'delete' | 'export';
                          return (
                            <td key={perm} className="px-5 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={r.permissions[pKey]}
                                onChange={() => togglePermission(r.id, pKey)}
                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-all"
                              />
                            </td>
                          );
                        })}

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteRole(r.id, r.name)}
                            disabled={r.id === '1' || r.id === '2'}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Purge Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Role Interactive Form */}
              {showRoleModal && (
                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black text-slate-800">Add New Security Privilege Profile</h4>
                  <form onSubmit={handleAddRole} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. Senior Payroll Analyst"
                      className="flex-1 bg-white border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRoleModal(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
                    >
                      Save Role
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: DEPARTMENT HIERARCHY */}
          {activeSection === 'dept-hierarchy' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4.5">
                <div>
                  <h3 className="text-base font-black text-slate-800">Department Hierarchy Matrix</h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Design department reporting lines and command chains.</p>
                </div>
                <button
                  onClick={() => setShowDeptForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all"
                >
                  <Plus className="w-4.5 h-4.5" />
                  Link New Department
                </button>
              </div>

              {/* Add Department Inline Form */}
              {showDeptForm && (
                <form onSubmit={handleAddDept} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black text-slate-800">Link New Hierarchy Node</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Department Name</label>
                      <input
                        type="text"
                        required
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        placeholder="e.g. Quality Assurance"
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Department Code</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={newDeptCode}
                        onChange={(e) => setNewDeptCode(e.target.value)}
                        placeholder="e.g. QA"
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Parent Department</label>
                      <select
                        value={newDeptParent}
                        onChange={(e) => setNewDeptParent(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      >
                        <option value="None">None (Root Executive Node)</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Assign Manager</label>
                      <input
                        type="text"
                        value={newDeptManager}
                        onChange={(e) => setNewDeptManager(e.target.value)}
                        placeholder="e.g. Alan Rickman"
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDeptForm(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300/80 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
                    >
                      Link Node
                    </button>
                  </div>
                </form>
              )}

              {/* Hierarchy Tree Visualization Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="border border-slate-100 bg-[#f8fafc]/50 p-4.5 rounded-2xl flex items-center justify-between hover:shadow-md hover:bg-white transition-all group">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {dept.code}
                        </span>
                        {dept.parent !== 'None' && (
                          <span className="text-[9.5px] text-slate-400 font-semibold">
                            sub of {dept.parent}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-800 truncate">{dept.name}</h4>
                      <p className="text-[10.5px] text-slate-500 font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Manager: <span className="font-bold text-slate-700">{dept.manager}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDept(dept.id, dept.name)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2"
                      title="Purge Node"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: REGIONAL SETTINGS */}
          {activeSection === 'regional-settings' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="border-b border-slate-100 pb-4.5">
                <h3 className="text-base font-black text-slate-800">Regional & Localization Parameters</h3>
                <p className="text-[11px] text-slate-400 font-bold mt-1">Configure workspace locale variables dynamically.</p>
              </div>

              <form onSubmit={handleSaveRegion} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Operational Country</label>
                    <select
                      value={regionConfig.country}
                      onChange={(e) => setRegionConfig({ ...regionConfig, country: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    >
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="Singapore">Singapore</option>
                      <option value="UAE">UAE</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">System Timezone</label>
                    <select
                      value={regionConfig.timezone}
                      onChange={(e) => setRegionConfig({ ...regionConfig, timezone: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    >
                      <option value="GMT+1 (BST)">GMT+1 (BST)</option>
                      <option value="IST (GMT+5:30)">IST (GMT+5:30)</option>
                      <option value="UTC">UTC (Universal Coordinate)</option>
                      <option value="EST (GMT-5)">EST (GMT-5)</option>
                      <option value="SGT (GMT+8)">SGT (GMT+8)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Base Operating Currency</label>
                    <select
                      value={regionConfig.currency}
                      onChange={(e) => setRegionConfig({ ...regionConfig, currency: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    >
                      <option value="GBP (£)">GBP (£) Sterling</option>
                      <option value="INR (₹)">INR (₹) Rupee</option>
                      <option value="USD ($)">USD ($) Dollar</option>
                      <option value="SGD (S$)">SGD (S$) Dollar</option>
                      <option value="AED (د.إ)">AED (د.إ) Dirham</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Date Display Format</label>
                    <select
                      value={regionConfig.dateFormat}
                      onChange={(e) => setRegionConfig({ ...regionConfig, dateFormat: e.target.value })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 14/07/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/14/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-14)</option>
                    </select>
                  </div>
                </div>

                {/* Switches */}
                <div className="bg-[#f8fafc] p-4.5 rounded-2xl border border-slate-150 space-y-4.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Daylight Saving Adjuster</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Automatically offset system server timestamps for DST shifts</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regionConfig.dstEnpatched}
                      onChange={() => setRegionConfig({ ...regionConfig, dstEnpatched: !regionConfig.dstEnpatched })}
                      className="w-9 h-5 bg-slate-200 checked:bg-blue-600 rounded-full cursor-pointer transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Enable Multi-Currency Invoicing</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Allow contractors or billing lines to select custom exchange rates</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={regionConfig.multiCurrency}
                      onChange={() => setRegionConfig({ ...regionConfig, multiCurrency: !regionConfig.multiCurrency })}
                      className="w-9 h-5 bg-slate-200 checked:bg-blue-600 rounded-full cursor-pointer transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingRegion}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-100 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingRegion ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 4: GLOBAL SYSTEM SETTINGS */}
          {activeSection === 'system-settings' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="border-b border-slate-100 pb-4.5">
                <h3 className="text-base font-black text-slate-800">Global Security & System Policy</h3>
                <p className="text-[11px] text-slate-400 font-bold mt-1">Configure operational limits, failed logins, and variables.</p>
              </div>

              <form onSubmit={handleSaveSystem} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Lockout After Failed Logins</label>
                    <input
                      type="number"
                      required
                      value={systemSettings.lockoutAttempts}
                      onChange={(e) => setSystemSettings({ ...systemSettings, lockoutAttempts: Number(e.target.value) })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Inactivity Timeout (Minutes)</label>
                    <input
                      type="number"
                      required
                      value={systemSettings.sessionTimeout}
                      onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeout: Number(e.target.value) })}
                      className="w-full bg-[#f8fafc] border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 space-y-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Password Policy Rules</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.passwordPolicy.requireSpecial}
                        onChange={() => setSystemSettings({
                          ...systemSettings,
                          passwordPolicy: { ...systemSettings.passwordPolicy, requireSpecial: !systemSettings.passwordPolicy.requireSpecial }
                        })}
                        className="rounded text-blue-600 focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">Require Special Character</span>
                    </label>

                    <label className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.passwordPolicy.requireNumber}
                        onChange={() => setSystemSettings({
                          ...systemSettings,
                          passwordPolicy: { ...systemSettings.passwordPolicy, requireNumber: !systemSettings.passwordPolicy.requireNumber }
                        })}
                        className="rounded text-blue-600 focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">Require Digit</span>
                    </label>

                    <label className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.passwordPolicy.requireCapital}
                        onChange={() => setSystemSettings({
                          ...systemSettings,
                          passwordPolicy: { ...systemSettings.passwordPolicy, requireCapital: !systemSettings.passwordPolicy.requireCapital }
                        })}
                        className="rounded text-blue-600 focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">Require Capital Letter</span>
                    </label>

                    <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-400">Min Chars:</span>
                      <input
                        type="number"
                        min={6}
                        max={16}
                        value={systemSettings.passwordPolicy.minChars}
                        onChange={(e) => setSystemSettings({
                          ...systemSettings,
                          passwordPolicy: { ...systemSettings.passwordPolicy, minChars: Number(e.target.value) }
                        })}
                        className="w-12 bg-slate-50 text-xs text-center border-0 p-1 font-bold text-slate-800 rounded focus:ring-1 focus:ring-blue-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#f8fafc] p-4.5 rounded-2xl border border-slate-150 space-y-4.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Maintenance Protocol Mode</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Restrict workspace logging access to global system administrators only</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.maintenanceMode}
                      onChange={() => setSystemSettings({ ...systemSettings, maintenanceMode: !systemSettings.maintenanceMode })}
                      className="w-9 h-5 bg-slate-200 checked:bg-blue-600 rounded-full cursor-pointer transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Enable Real-Time WebSocket Sync</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Auto-update analytics graphs and clock metrics across connected nodes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.websocketSync}
                      onChange={() => setSystemSettings({ ...systemSettings, websocketSync: !systemSettings.websocketSync })}
                      className="w-9 h-5 bg-slate-200 checked:bg-blue-600 rounded-full cursor-pointer transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSys}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-100 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingSys ? 'Updating...' : 'Save Security Rules'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 5: SYSTEM GLOSSARY CODES */}
          {activeSection === 'system-glossary' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4.5">
                <div>
                  <h3 className="text-base font-black text-slate-800">System Glossary Dictionary</h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Configure terminology mapping and system exception logs reference keys.</p>
                </div>
                <button
                  onClick={() => setShowGlossaryForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all"
                >
                  <Plus className="w-4.5 h-4.5" />
                  Add Glossary Code
                </button>
              </div>

              {/* Add Glossary Code Form */}
              {showGlossaryForm && (
                <form onSubmit={handleAddGlossary} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black text-slate-800">New Terminology Key Mapping</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Glossary Code ID</label>
                      <input
                        type="text"
                        required
                        value={newGlossaryCode}
                        onChange={(e) => setNewGlossaryCode(e.target.value)}
                        placeholder="e.g. ERR_SESSION_KILLED"
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Meaning</label>
                      <input
                        type="text"
                        required
                        value={newGlossaryMeaning}
                        onChange={(e) => setNewGlossaryMeaning(e.target.value)}
                        placeholder="e.g. Active token expired or dropped"
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Category Type</label>
                      <select
                        value={newGlossaryType}
                        onChange={(e) => setNewGlossaryType(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 font-semibold"
                      >
                        <option value="Info Notification">Info Notification</option>
                        <option value="Error Log">Error Log</option>
                        <option value="Database Log">Database Log</option>
                        <option value="Validation Warning">Validation Warning</option>
                        <option value="Security Log">Security Log</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Detailed Technical Description</label>
                      <textarea
                        value={newGlossaryDesc}
                        onChange={(e) => setNewGlossaryDesc(e.target.value)}
                        placeholder="Identify constraints or stack trace origin for developers..."
                        className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500 font-semibold h-20"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowGlossaryForm(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300/80 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
                    >
                      Register Term
                    </button>
                  </div>
                </form>
              )}

              {/* Glossary list */}
              <div className="space-y-4">
                {glossaryTerms.map((term, idx) => (
                  <div key={idx} className="border border-slate-100 bg-[#f8fafc]/40 p-4.5 rounded-2xl flex items-start justify-between hover:bg-white hover:shadow-md transition-all group">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {term.code}
                        </span>
                        <span className="text-[9.5px] font-black text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                          {term.type}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-800">{term.meaning}</h4>
                      <p className="text-[11px] text-slate-400 leading-normal font-semibold font-sans">{term.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteGlossary(term.code)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2"
                      title="Purge Term"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: USER LOGIN AUDIT LOGS */}
          {activeSection === 'login-audit' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm text-left animate-fade-in space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4.5">
                <div>
                  <h3 className="text-base font-black text-slate-800">Security Login Audit Logs</h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Real-time audit trails of credential logins, locations, and clients.</p>
                </div>
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-200 text-[11px] text-slate-700 pl-9 pr-3 py-2 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3">User Client ID</th>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">IP Address</th>
                      <th className="px-5 py-3">Approx Location</th>
                      <th className="px-5 py-3">Device Agent</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {auditLogs
                      .filter(log =>
                        log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.ip.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.location.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.status.toLowerCase().includes(auditSearch.toLowerCase())
                      )
                      .map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-slate-700">{log.user}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[11px] text-slate-500 font-bold">{log.time}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600">{log.ip}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-semibold">{log.location}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[11px] text-slate-400 font-bold truncate max-w-[120px]">{log.device}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              log.status === 'Success'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-red-50 text-red-600 border border-red-100 animate-pulse'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
