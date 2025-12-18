
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser, BrainCircuit, Timer, Search, Archive, RotateCcw, Truck, MapPin, User, ChevronLeft, ChevronRight, Wifi, UploadCloud } from 'lucide-react';
import { analyzeBusinessData } from '../services/geminiService';
import { read, utils, writeFile } from 'xlsx';
import { dbService } from '../services/db';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EC1D25'];

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

const TimeInput = ({ value, onChange, className, placeholder }: { value: string, onChange: (val: string) => void, className?: string, placeholder?: string }) => {
    const [localVal, setLocalVal] = useState(value || '');

    useEffect(() => {
        setLocalVal(value || '');
    }, [value]);

    const handleBlur = () => {
        let v = localVal.trim();
        if (!v) {
            if (value) onChange(''); 
            return;
        }
        v = v.replace('.', ':').replace(',', ':');
        if (v.length === 4 && !v.includes(':') && !isNaN(Number(v))) {
            v = v.slice(0, 2) + ':' + v.slice(2);
        }
        if (v.length === 3 && !v.includes(':') && !isNaN(Number(v))) {
            v = '0' + v.slice(0, 1) + ':' + v.slice(1);
        }
        if (v.length <= 2 && !v.includes(':') && !isNaN(Number(v))) {
             v = v.padStart(2, '0') + ':00';
        }
        const parts = v.split(':');
        if (parts.length === 2) {
            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]);
            if (!isNaN(h) && !isNaN(m)) {
                if (h < 0) h = 0; if (h > 23) h = 23;
                if (m < 0) m = 0; if (m > 59) m = 59;
                const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (formatted !== value) onChange(formatted);
                setLocalVal(formatted);
                return;
            }
        }
        setLocalVal(value || '');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    }

    return (
        <input 
            type="text" 
            className={className}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "--:--"}
        />
    );
};

export const AdminDashboard: React.FC<Props> = ({ jobs, logs, employees, attendance, vehicles = [], vehicleLogs = [], justifications = [], customPrompts = [], permissions = {}, onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, onSavePermissions, onUpdateLog, currentUserRole, settings, onSaveSettings, onSaveAttendance, onDeleteAttendance, onSaveVehicle, onDeleteVehicle }) => {
  
  // Permissions Logic
  const isGodMode = currentUserRole === Role.SYSTEM_ADMIN || currentUserRole === Role.DIRECTION;
  const isSystem = currentUserRole === Role.SYSTEM_ADMIN;
  
  const getAllowedTabs = () => {
      if (isSystem) return ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE', 'CONFIG'];
      if (currentUserRole === Role.DIRECTION) return ['OVERVIEW', 'JOBS', 'HR', 'FLEET', 'AI', 'MANAGE'];
      const rolePerms = permissions[currentUserRole];
      if (rolePerms && rolePerms.length > 0) return rolePerms;
      switch(currentUserRole) {
          case Role.ADMIN:
          case Role.ACCOUNTING:
              return ['OVERVIEW', 'HR', 'FLEET', 'JOBS', 'MANAGE'];
          case Role.SALES:
          case Role.TECHNICAL:
              return ['OVERVIEW', 'JOBS', 'MANAGE', 'FLEET', 'AI'];
          default:
              return ['OVERVIEW'];
      }
  }

  const allowedTabsList = getAllowedTabs();

  const allPossibleTabs = [
    {id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard},
    {id: 'JOBS', label: 'Analisi Commesse', icon: Briefcase},
    {id: 'HR', label: 'HR & PAGHE', icon: Users},
    {id: 'FLEET', label: 'PARCO MEZZI', icon: Truck},
    {id: 'AI', label: 'AI Analyst', icon: BrainCircuit},
    {id: 'MANAGE', label: 'GESTIONE DATI', icon: Settings},
    {id: 'CONFIG', label: 'CONFIGURAZIONE', icon: Wrench}
  ];

  const availableTabs = allPossibleTabs.filter(t => allowedTabsList.includes(t.id));

  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'OVERVIEW');
  const [manageSubTab, setManageSubTab] = useState<'JOBS' | 'EMPLOYEES'>('JOBS');
  
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState<string | null>(null);
  const [jobSort, setJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  const [manageJobSort, setManageJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [viewArchiveYear, setViewArchiveYear] = useState<string>('active');

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [isEditingJob, setIsEditingJob] = useState<Partial<Job> | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState<Partial<Employee> | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Stats computation
  const jobStats = useMemo(() => {
    return jobs.map(job => {
      const jobLogs = logs.filter(l => l.jobId === job.id);
      const totalHoursUsed = jobLogs.reduce((acc, log) => acc + log.hours, 0);
      const totalCost = jobLogs.reduce((acc, log) => {
        const emp = employees.find(e => e.id === log.employeeId);
        return acc + (log.hours * (emp ? emp.hourlyRate : 0));
      }, 0);
      const isOverBudget = totalHoursUsed > job.budgetHours;
      const profitMargin = job.budgetValue - totalCost;
      const sortedLogs = [...jobLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const startDate = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length-1].date : job.creationDate || '-';
      const lastPhase = sortedLogs.length > 0 ? sortedLogs[0].phase : '-';
      return { ...job, totalHoursUsed, totalCost, profitMargin, isOverBudget, startDate, lastPhase };
    });
  }, [jobs, logs, employees]);

  const sortedJobStats = useMemo(() => {
      let data = jobStats.filter(j => !j.isArchived);
      if (globalSearchTerm.length >= 3) {
          const s = globalSearchTerm.toLowerCase();
          data = data.filter(j => j.code.toLowerCase().includes(s) || j.clientName.toLowerCase().includes(s));
      }
      return data;
  }, [jobStats, globalSearchTerm]);

  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsLoadingAi(true);
    setAiResponse('');
    try {
        const result = await analyzeBusinessData(aiPrompt, { jobs: jobStats, logs, employees });
        setAiResponse(result);
    } catch (e) {
        setAiResponse("Errore analisi AI.");
    } finally {
        setIsLoadingAi(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Pannello Amministrazione</h1>
          <p className="text-slate-500">Gestione aziendale Alea Sistemi</p>
        </div>
      </div>

      <div className="border-b border-slate-200 print:hidden bg-white px-6 rounded-t-xl shadow-sm">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-[#EC1D25] text-[#EC1D25]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              {tab.icon && <tab.icon size={16}/>} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white p-6 rounded-b-xl shadow-sm min-h-[500px]">
        {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-slate-500"><Briefcase size={20}/> <span className="text-sm font-bold">Commesse Attive</span></div>
                    <div className="text-3xl font-black text-slate-900">{jobs.filter(j => !j.isArchived).length}</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-slate-500"><Users size={20}/> <span className="text-sm font-bold">Dipendenti</span></div>
                    <div className="text-3xl font-black text-slate-900">{employees.length}</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-slate-500"><Clock size={20}/> <span className="text-sm font-bold">Ore Totali</span></div>
                    <div className="text-3xl font-black text-slate-900">{logs.reduce((a,b) => a + b.hours, 0).toFixed(1)}</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-2 text-slate-500"><AlertTriangle size={20} className="text-red-500"/> <span className="text-sm font-bold">In Ritardo</span></div>
                    <div className="text-3xl font-black text-red-600">{jobStats.filter(j => j.isOverBudget).length}</div>
                </div>
            </div>
        )}

        {activeTab === 'JOBS' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Cerca per codice o cliente..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#EC1D25]/20 focus:border-[#EC1D25]"
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-widest text-[10px] border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Codice</th>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3">Stato</th>
                                <th className="px-4 py-3">Ore</th>
                                <th className="px-4 py-3">Budget</th>
                                <th className="px-4 py-3 text-right">Margine</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedJobStats.map(j => (
                                <tr key={j.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-bold text-slate-900">{j.code}</td>
                                    <td className="px-4 py-3 text-slate-600">{j.clientName}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${j.status === JobStatus.COMPLETED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{j.status}</span>
                                    </td>
                                    <td className={`px-4 py-3 font-mono ${j.isOverBudget ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{j.totalHoursUsed.toFixed(1)}h</td>
                                    <td className="px-4 py-3 text-slate-400">{j.budgetHours}h</td>
                                    <td className={`px-4 py-3 text-right font-bold ${j.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{j.profitMargin.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'AI' && (
            <div className="flex flex-col h-[600px] border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="p-4 bg-slate-900 text-white flex items-center gap-3">
                    <BrainCircuit className="text-[#EC1D25]" />
                    <span className="font-bold">Alea AI Business Analyst</span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
                    {aiResponse ? (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 prose prose-slate max-w-none">
                            {aiResponse.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                            {isLoadingAi ? <Loader2 size={48} className="animate-spin mb-4" /> : "Fai una domanda sui tuoi dati aziendali..."}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white border-t border-slate-200 flex gap-4">
                    <input 
                        type="text" 
                        placeholder="Es: Quali sono le 3 commesse più redditizie?" 
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#EC1D25]/20"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    />
                    <button 
                        onClick={() => handleAskAI()} 
                        disabled={isLoadingAi}
                        className="bg-[#EC1D25] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition"
                    >
                        {isLoadingAi ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} />} Analizza
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

interface Props {
  jobs: Job[];
  logs: WorkLog[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  vehicles?: Vehicle[];
  vehicleLogs?: VehicleLog[];
  justifications: DayJustification[];
  customPrompts: AIQuickPrompt[];
  permissions: RolePermissions;
  onSaveJob: (job: Job) => void;
  onSaveEmployee: (emp: Employee) => void;
  onSaveJustification: (just: DayJustification) => void;
  onSaveAiPrompts: (prompts: AIQuickPrompt[]) => void;
  onSavePermissions: (perms: RolePermissions) => void;
  onUpdateLog: (log: WorkLog) => void;
  currentUserRole: Role;
  settings: GlobalSettings;
  onSaveSettings: (settings: GlobalSettings) => void;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onDeleteAttendance: (recordId: string) => void;
  onSaveVehicle?: (vehicle: Vehicle) => void;
  onDeleteVehicle?: (id: string) => void;
}
