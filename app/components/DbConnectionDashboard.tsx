import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Terminal, 
  Copy, 
  Check, 
  HelpCircle, 
  ExternalLink,
  BookOpen,
  Info,
  Layers,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Shield,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

interface DbStatusData {
  success: boolean;
  message: string;
  isEmulated?: boolean;
  data?: {
    db_time: string;
    db_version: string;
  };
  error?: string;
}

interface TypeMstRecord {
  typ_id: string;
  typ_cd: string;
  typ_nm: string;
  view_nm: string | null;
  parent_typ_id: string | null;
  is_editable: string;
  is_predefined: string;
  table_type: string;
  visible_to_user_flag: string;
  user_can_create_data: string;
  originating_module: string | null;
  module_seq: string | null;
  originating_system: string | null;
  is_deleted: string;
  created_on?: string;
}

export default function DbConnectionDashboard() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<DbStatusData | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'setup-guide' | 'query' | 'type-catalog'>('status');
  
  // Custom states for demo queries or actions
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [executingSql, setExecutingSql] = useState(false);

  // States for Type Master Catalog
  const [typeRecords, setTypeRecords] = useState<TypeMstRecord[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  
  // Drag & drop file upload states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [newType, setNewType] = useState<Partial<TypeMstRecord>>({
    typ_id: '',
    typ_cd: '',
    typ_nm: '',
    view_nm: '',
    parent_typ_id: '',
    is_editable: '1',
    is_predefined: '0',
    table_type: 'USER',
    visible_to_user_flag: '1',
    user_can_create_data: '1',
    originating_module: 'Accounts',
    module_seq: '0',
    originating_system: 'Global HR Setup'
  });

  const checkConnection = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const res = await fetch('/api/db-check');
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setStatus({
        success: false,
        message: 'Could not communicate with the backend application server.',
        error: err.message || String(err)
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const fetchTypeRecords = async () => {
    setLoadingTypes(true);
    try {
      const res = await fetch('/api/types');
      const data = await res.json();
      if (data.success) {
        setTypeRecords(data.data || []);
      }
    } catch (e) {
      console.error("Error loading type_mst records:", e);
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'type-catalog') {
      fetchTypeRecords();
    }
  }, [activeTab]);

  // Parse CSV string safely
  const parseCsvText = (text: string): Partial<TypeMstRecord>[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Parse headers - trim whitespace and remove quotes
    const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    
    const records: Partial<TypeMstRecord>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple quote-aware CSV cell parser
      const cells: string[] = [];
      let currentCell = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim());
      
      // Build row object
      const row: any = {};
      headers.forEach((header, index) => {
        let val = cells[index] || '';
        // Remove enclosing quotes or NULL/null strings
        val = val.replace(/^["']|["']$/g, '').trim();
        if (val.toUpperCase() === 'NULL' || val === '') {
          row[header] = null;
        } else {
          row[header] = val;
        }
      });
      
      // Ensure we have the minimum fields
      const mappedRecord: Partial<TypeMstRecord> = {
        typ_id: row.typ_id || row.id || '',
        typ_cd: row.typ_cd || row.cd || row.code || '',
        typ_nm: row.typ_nm || row.nm || row.name || '',
        view_nm: row.view_nm || null,
        parent_typ_id: row.parent_typ_id || null,
        is_editable: row.is_editable !== undefined ? String(row.is_editable) : '1',
        is_predefined: row.is_predefined !== undefined ? String(row.is_predefined) : '0',
        table_type: row.table_type || 'USER',
        visible_to_user_flag: row.visible_to_user_flag !== undefined ? String(row.visible_to_user_flag) : '1',
        user_can_create_data: row.user_can_create_data !== undefined ? String(row.user_can_create_data) : '1',
        originating_module: row.originating_module || null,
        module_seq: row.module_seq !== undefined ? String(row.module_seq) : '0',
        originating_system: row.originating_system || null,
        is_deleted: row.is_deleted !== undefined ? String(row.is_deleted) : '0'
      };
      
      if (mappedRecord.typ_id && mappedRecord.typ_cd && mappedRecord.typ_nm) {
        records.push(mappedRecord);
      }
    }
    return records;
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadingCsv(true);
    setSeedStatus(null);
    
    if (!file.name.endsWith('.csv')) {
      setUploadError("Only standard CSV files (.csv) are supported.");
      setUploadingCsv(false);
      return;
    }
    
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      
      if (parsed.length === 0) {
        setUploadError("No valid rows found in CSV. Ensure columns 'typ_id', 'typ_cd', and 'typ_nm' are present.");
        setUploadingCsv(false);
        return;
      }
      
      const response = await fetch('/api/types/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: parsed })
      });
      
      const data = await response.json();
      if (data.success) {
        setSeedStatus({ success: true, message: `Successfully imported ${parsed.length} database records from "${file.name}"!` });
        await fetchTypeRecords();
      } else {
        setUploadError(data.error || "Failed to bulk import parsed records.");
      }
    } catch (err: any) {
      setUploadError(err.message || String(err));
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSeedTypeMst = async () => {
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await fetch('/api/types/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedStatus({ success: true, message: data.message });
        await fetchTypeRecords();
      } else {
        setSeedStatus({ success: false, message: data.error || "Failed to initialize and seed." });
      }
    } catch (err: any) {
      setSeedStatus({ success: false, message: err.message || String(err) });
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteType = async (typId: string) => {
    if (!confirm(`Are you sure you want to delete the Type Master record: "${typId}"?`)) return;
    try {
      const res = await fetch(`/api/types/${typId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchTypeRecords();
      } else {
        alert(data.error || "Failed to delete record.");
      }
    } catch (err: any) {
      alert(err.message || String(err));
    }
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.typ_id || !newType.typ_cd || !newType.typ_nm) {
      alert("Please fill in all required fields (Type ID, Code, Name)");
      return;
    }
    setSavingType(true);
    try {
      const res = await fetch('/api/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newType)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewType({
          typ_id: '',
          typ_cd: '',
          typ_nm: '',
          view_nm: '',
          parent_typ_id: '',
          is_editable: '1',
          is_predefined: '0',
          table_type: 'USER',
          visible_to_user_flag: '1',
          user_can_create_data: '1',
          originating_module: 'Accounts',
          module_seq: '0',
          originating_system: 'Global HR Setup'
        });
        await fetchTypeRecords();
      } else {
        alert(data.error || "Failed to save record.");
      }
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setSavingType(false);
    }
  };

  const handleCopy = (text: string, varName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const handleCreateDemoTables = async () => {
    setExecutingSql(true);
    setSqlError(null);
    setSqlResult(null);
    try {
      const res = await fetch('/api/db-check');
      const data = await res.json();
      if (data.success) {
        setSqlResult([{ message: data.isEmulated 
          ? "Workspace Emulation active! Tables and schema definitions are ready to store logs locally." 
          : "The real database connection is active! You can now start creating tables on your cloud PostgreSQL instance." 
        }]);
      } else {
        setSqlError(data.error || "Database is currently offline. Please configure your environment variables first.");
      }
    } catch (err: any) {
      setSqlError(err.message || String(err));
    } finally {
      setExecutingSql(false);
    }
  };

  return (
    <div id="db-connection-dashboard" className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 animate-fade-in font-sans">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Database className="w-5 h-5 stroke-[2]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              PostgreSQL Environment Setup
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Configure, manage, and verify your active PostgreSQL database connections and configurations.
          </p>
        </div>

        <button
          onClick={checkConnection}
          disabled={checking}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-600 font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking Connection...' : 'Check DB Connection'}
        </button>
      </div>

      {/* Connection Indicator Bar */}
      {status && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
          !status.success 
            ? 'bg-rose-50/40 border-rose-100 text-rose-800' 
            : status.isEmulated
              ? 'bg-amber-50/40 border-amber-100 text-amber-900'
              : 'bg-emerald-50/40 border-emerald-100 text-emerald-800'
        }`}>
          {!status.success ? (
            <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          ) : status.isEmulated ? (
            <Database className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-extrabold text-xs sm:text-sm tracking-tight">
              {!status.success 
                ? 'PostgreSQL Connection Offline' 
                : status.isEmulated
                  ? 'PostgreSQL Emulated Local Mode'
                  : 'PostgreSQL Cloud Connection Successful!'}
            </p>
            <p className="text-slate-500 text-[11px] leading-relaxed font-semibold">
              {status.message}
            </p>
            {status.data && (
              <div className="mt-3.5 bg-slate-900 text-slate-100 rounded-xl p-3 text-[10px] font-mono leading-relaxed shadow-inner max-w-xl">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-1.5 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Connection Metadata
                </div>
                <div><span className="text-emerald-400">Database Time:</span> {status.data.db_time}</div>
                <div className="mt-1 truncate"><span className="text-emerald-400">Engine Version:</span> {status.data.db_version}</div>
              </div>
            )}
            {status.error && (
              <div className="mt-3.5 bg-red-950/20 border border-red-200/30 text-red-700 rounded-xl p-3.5 text-[11px] font-mono leading-relaxed max-w-xl overflow-x-auto whitespace-pre-wrap">
                <div className="font-bold text-red-800 uppercase tracking-wider text-[9px] mb-1">Error Logs:</div>
                {status.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-100 gap-6 select-none">
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-3 font-bold text-xs relative transition-all ${
            activeTab === 'status' 
              ? 'text-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'status' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          Status & Secrets Info
        </button>
        <button
          onClick={() => setActiveTab('setup-guide')}
          className={`pb-3 font-bold text-xs relative transition-all ${
            activeTab === 'setup-guide' 
              ? 'text-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'setup-guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          PostgreSQL Setup Guide
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={`pb-3 font-bold text-xs relative transition-all ${
            activeTab === 'query' 
              ? 'text-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'query' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          Schema & Table Builder
        </button>
        <button
          onClick={() => setActiveTab('type-catalog')}
          className={`pb-3 font-bold text-xs relative transition-all ${
            activeTab === 'type-catalog' 
              ? 'text-blue-600' 
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          {activeTab === 'type-catalog' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          Type Master Catalog
        </button>
      </div>

      {/* Content */}
      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Environment variables card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Configured Environment Secrets
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                We have registered the environment variables inside <code className="bg-slate-50 px-1 py-0.5 rounded text-rose-500 text-[10px] font-mono">.env.example</code>. 
                You can configure these variables in your **Google AI Studio Environment Variables Settings Menu** so that the application can read them.
              </p>

              <div className="space-y-3.5 mt-4">
                {[
                  {
                    name: 'DATABASE_URL',
                    desc: 'Fully-formed PostgreSQL connection URI string (recommended).',
                    val: 'postgresql://postgres:password@localhost:5432/hr_db?sslmode=require'
                  },
                  {
                    name: 'PGHOST',
                    desc: 'Database host address (use if not using DATABASE_URL).',
                    val: 'localhost'
                  },
                  {
                    name: 'PGPORT',
                    desc: 'Connection port number (default is 5432).',
                    val: '5432'
                  },
                  {
                    name: 'PGUSER',
                    desc: 'Database username.',
                    val: 'postgres'
                  },
                  {
                    name: 'PGPASSWORD',
                    desc: 'Secret database password.',
                    val: '••••••••••••'
                  },
                  {
                    name: 'PGDATABASE',
                    desc: 'Target database name.',
                    val: 'hr_db'
                  }
                ].map((item) => (
                  <div key={item.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded">
                          {item.name}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">Secret</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {item.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 select-all tracking-tight font-bold">
                        {item.val}
                      </span>
                      <button
                        onClick={() => handleCopy(item.name, item.name)}
                        className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-700 border border-transparent hover:border-slate-100 rounded-lg transition-all"
                        title={`Copy ${item.name}`}
                      >
                        {copiedVar === item.name ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick FAQ info panel */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-850 p-5 sm:p-6 shadow-xl text-white space-y-4 font-sans text-left">
              <div className="flex items-center gap-2 text-blue-400">
                <HelpCircle className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  How does AI Studio read keys?
                </h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                By default, environment secrets are managed outside the code to keep your credentials safe.
              </p>
              <div className="space-y-3 pt-1 text-[11px]">
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">1</div>
                  <p className="text-slate-300 font-semibold leading-relaxed">
                    Open the **Settings** menu at the top-right of your AI Studio workspace.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">2</div>
                  <p className="text-slate-300 font-semibold leading-relaxed">
                    Locate the **Environment Variables / Secrets** tab.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">3</div>
                  <p className="text-slate-300 font-semibold leading-relaxed">
                    Add the connection values (or paste your <code className="text-blue-300">DATABASE_URL</code>).
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-800 pt-3.5 text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                The development server automatically restarts and picks up new environment settings.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'setup-guide' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 text-left shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Choosing a PostgreSQL Setup
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Local Server Setup */}
            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/30 space-y-3.5">
              <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Option A: Local Desktop (Localhost)
              </span>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Connect to local Postgres
              </h4>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                If you have PostgreSQL installed on your computer:
              </p>
              
              <div className="bg-slate-900 rounded-xl p-3.5 text-[10.5px] font-mono text-slate-300 space-y-1.5">
                <div><span className="text-amber-400"># 1. Create your database:</span></div>
                <div>createdb hr_db</div>
                <div className="pt-1.5"><span className="text-amber-400"># 2. Expose local database if needed, or set credentials:</span></div>
                <div>PGHOST="localhost"</div>
                <div>PGPORT="5432"</div>
                <div>PGUSER="postgres"</div>
                <div>PGPASSWORD="your_password"</div>
                <div>PGDATABASE="hr_db"</div>
              </div>

              <div className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                ⚠️ Note: For a cloud workspace like AI Studio to connect to your local computer's database directly, you will need a tunnel client like Ngrok or Cloudflare Tunnels, or use a cloud database instance.
              </div>
            </div>

            {/* Cloud Database Setup */}
            <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/30 space-y-3.5">
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Option B: Free Cloud Instance (Recommended)
              </span>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Use a free managed Postgres database
              </h4>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Services like **Neon.tech**, **Supabase**, or **Render** provision a fully-functional secure PostgreSQL database in 5 seconds for free:
              </p>

              <ol className="text-[11px] text-slate-500 font-semibold space-y-2 list-decimal list-inside">
                <li>Create a free account on <a href="https://neon.tech" target="_blank" rel="noreferrer" className="text-blue-600 font-black hover:underline inline-flex items-center gap-0.5">Neon.tech <ExternalLink className="w-3 h-3 inline" /></a> or Supabase.</li>
                <li>Create a new project named <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">hr-database</code>.</li>
                <li>Copy the provided **Connection String** (<code className="text-slate-700">postgresql://...</code>).</li>
                <li>Set the connection string in the AI Studio environment variables as <code className="bg-slate-100 px-1 py-0.5 rounded font-bold">DATABASE_URL</code>.</li>
              </ol>

              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-[10.5px] font-semibold flex items-start gap-2 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Our system automatically enables SSL connections securely for cloud instances.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'query' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 text-left shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Initialize Database Tables & Schemas
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              Once connected to your active PostgreSQL instance, execute this command to create the employee management tables.
            </p>
          </div>

          <div className="bg-slate-900 rounded-2xl p-4 text-[10.5px] font-mono text-slate-300 relative leading-relaxed max-h-80 overflow-y-auto">
            <button
              onClick={() => handleCopy(`-- HR Enterprise PostgreSQL Table schemas
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  joining_date DATE,
  status VARCHAR(50) DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) REFERENCES employees(employee_id),
  punch_date DATE DEFAULT CURRENT_DATE,
  punch_in TIMESTAMP,
  punch_out TIMESTAMP,
  status VARCHAR(50)
);`, 'sql-schema')}
              className="absolute right-4 top-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-all border border-slate-700"
              title="Copy SQL Schema"
            >
              {copiedVar === 'sql-schema' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            
            <pre className="whitespace-pre-wrap">{`-- HR Enterprise PostgreSQL Table schemas
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  joining_date DATE,
  status VARCHAR(50) DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL,
  punch_date DATE DEFAULT CURRENT_DATE,
  punch_in TIMESTAMP,
  punch_out TIMESTAMP,
  status VARCHAR(50)
);`}</pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between border-t border-slate-50 pt-5">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-700">Verify connection & Setup Tables</span>
              <p className="text-[10px] text-slate-400 font-semibold">Test current connection and print DB version logs.</p>
            </div>
            <button
              onClick={handleCreateDemoTables}
              disabled={executingSql || checking}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
            >
              {executingSql ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                'Run Connection Test & Tables Check'
              )}
            </button>
          </div>

          {sqlResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-[11px] font-mono leading-relaxed space-y-1">
              <div className="font-extrabold text-xs text-emerald-900 mb-1">Result Logs:</div>
              {sqlResult.map((row, idx) => (
                <div key={idx}>{JSON.stringify(row, null, 2)}</div>
              ))}
            </div>
          )}

          {sqlError && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-[11px] font-mono leading-relaxed space-y-1">
              <div className="font-extrabold text-xs text-rose-900 mb-1">Error Logs:</div>
              <div>{sqlError}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'type-catalog' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-blue-500" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Type Master Data Manager (type_mst)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-semibold">
                  Configure and view master codes, tables, permission sets, and system classifications.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSeedTypeMst}
                  disabled={seeding}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${seeding ? 'animate-bounce' : ''}`} />
                  {seeding ? "Seeding..." : "Seed CSV Data into DB"}
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-100 active:scale-95 inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Add Custom Type
                </button>
              </div>
            </div>

            {seedStatus && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                seedStatus.success 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}>
                {seedStatus.success ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <p className="font-semibold">{seedStatus.message}</p>
              </div>
            )}

            {/* Drag & Drop CSV Uploader */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 transition-all text-center flex flex-col items-center justify-center gap-3.5 ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/50' 
                  : 'border-slate-200 bg-slate-50/30 hover:bg-slate-50/60'
              }`}
            >
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <UploadCloud className={`w-6 h-6 ${uploadingCsv ? 'animate-bounce' : ''}`} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-700">
                  {uploadingCsv ? "Parsing and importing database records..." : "Drag & Drop your whole CSV database here"}
                </p>
                <p className="text-[10px] text-slate-400 font-bold max-w-md mx-auto leading-relaxed">
                  Imports and updates records instantly. Supports standard database CSV backups with headers matching: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-500 font-mono">typ_id, typ_cd, typ_nm</code>.
                </p>
              </div>
              
              {!uploadingCsv && (
                <label className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all active:scale-95">
                  Browse CSV File
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        await handleFileUpload(e.target.files[0]);
                      }
                    }} 
                  />
                </label>
              )}
              
              {uploadError && (
                <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1.5 justify-center">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
                </p>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search types by Code, Name, view or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:bg-white focus:outline-none rounded-xl text-xs font-semibold placeholder:text-slate-400 text-slate-700 transition-all"
                />
              </div>

              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:border-blue-300 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Modules ({typeRecords.length})</option>
                {Array.from(new Set(typeRecords.map(r => r.originating_module).filter(Boolean))).map(mod => (
                  <option key={mod} value={mod || ''}>{mod}</option>
                ))}
              </select>
            </div>

            {/* Main Table / Grid */}
            {loadingTypes ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">
                  Loading Master Catalog...
                </span>
              </div>
            ) : typeRecords.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center p-6 space-y-4">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                  <Database className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="font-extrabold text-sm text-slate-800">No Type Master Table loaded yet</p>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    The database table <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-500 font-mono">type_mst</code> is currently empty or uninitialized.
                  </p>
                </div>
                <button
                  onClick={handleSeedTypeMst}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all"
                >
                  Create & Seed 100+ CSV Records
                </button>
              </div>
            ) : (() => {
              const filtered = typeRecords.filter(rec => {
                const queryLower = searchQuery.toLowerCase();
                const matchesSearch = 
                  rec.typ_cd.toLowerCase().includes(queryLower) ||
                  rec.typ_nm.toLowerCase().includes(queryLower) ||
                  rec.typ_id.toString().includes(queryLower) ||
                  (rec.view_nm && rec.view_nm.toLowerCase().includes(queryLower));
                
                const matchesModule = moduleFilter === 'ALL' || rec.originating_module === moduleFilter;
                return matchesSearch && matchesModule;
              });

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>Showing {filtered.length} matching types</span>
                    {status?.isEmulated && (
                      <span className="text-amber-600 flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Emulation Mode
                      </span>
                    )}
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                          <th className="py-3 px-4 w-20">ID</th>
                          <th className="py-3 px-4 w-28">Code</th>
                          <th className="py-3 px-4">Name & View Target</th>
                          <th className="py-3 px-4">Originating Module</th>
                          <th className="py-3 px-4 w-32">Table Type</th>
                          <th className="py-3 px-4 w-28 text-center">Predefined</th>
                          <th className="py-3 px-4 w-20 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-600">
                        {filtered.map(rec => (
                          <tr key={rec.typ_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                              #{rec.typ_id}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-xs bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-lg text-slate-800 font-extrabold uppercase">
                                {rec.typ_cd}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="text-slate-800 font-black text-xs">{rec.typ_nm}</div>
                                {rec.view_nm ? (
                                  <div className="text-[10px] font-mono text-blue-500 flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-blue-400" /> {rec.view_nm}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400 italic font-medium">No View bound</div>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full font-bold">
                                {rec.originating_module || 'System Manager'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`text-[10px] font-bold ${
                                rec.table_type === 'SYSTEM' ? 'text-purple-600' : 'text-slate-500'
                              }`}>
                                {rec.table_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {rec.is_predefined === '1' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                  <Shield className="w-3 h-3 text-blue-500" /> YES
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">NO</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleDeleteType(rec.typ_id)}
                                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-all"
                                title="Delete record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Custom Type Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600 stroke-[2.5]" /> Add Custom Type Master
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Type ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5001"
                    value={newType.typ_id}
                    onChange={(e) => setNewType({...newType, typ_id: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Type Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CUSTOM_CD"
                    value={newType.typ_cd}
                    onChange={(e) => setNewType({...newType, typ_cd: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Custom Settings Code"
                  value={newType.typ_nm}
                  onChange={(e) => setNewType({...newType, typ_nm: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">View Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. custom_settings_mst_vw"
                  value={newType.view_nm || ''}
                  onChange={(e) => setNewType({...newType, view_nm: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Originating Module</label>
                  <input
                    type="text"
                    placeholder="e.g. Accounts"
                    value={newType.originating_module || ''}
                    onChange={(e) => setNewType({...newType, originating_module: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Table Type</label>
                  <select
                    value={newType.table_type}
                    onChange={(e) => setNewType({...newType, table_type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="USER">USER</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Is Predefined?</label>
                  <select
                    value={newType.is_predefined}
                    onChange={(e) => setNewType({...newType, is_predefined: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="0">NO</option>
                    <option value="1">YES</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Is Editable?</label>
                  <select
                    value={newType.is_editable}
                    onChange={(e) => setNewType({...newType, is_editable: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="1">YES</option>
                    <option value="0">NO</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingType}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-100 active:scale-95 disabled:opacity-50"
                >
                  {savingType ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
