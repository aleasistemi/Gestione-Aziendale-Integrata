
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeBusinessData } from '../services/geminiService';
import { read, utils, writeFile } from 'xlsx';
import { dbService } from '../services/db';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser, BrainCircuit, Timer, Search, Archive, RotateCcw, Truck, MapPin, User, ChevronLeft, ChevronRight, Wifi, UploadCloud } from 'lucide-react';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EC1D25'];

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

const TimeInput = ({ value, onChange, className, placeholder }: { value: string, onChange: (val: string) => void, className?: string, placeholder?: string }) => {
    const [localVal, setLocalVal] = useState(value || '');
    useEffect(() => { setLocalVal(value || ''); }, [value]);
    const handleBlur = () => {
        let v = localVal.trim();
        if (!v) { if (value) onChange(''); return; }
        v = v.replace('.', ':').replace(',', ':');
        if (v.length === 4 && !v.includes(':') && !isNaN(Number(v))) v = v.slice(0, 2) + ':' + v.slice(2);
        if (v.length === 3 && !v.includes(':') && !isNaN(Number(v))) v = '0' + v.slice(0, 1) + ':' + v.slice(1);
        const parts = v.split(':');
        if (parts.length === 2) {
            let h = parseInt(parts[0]); let m = parseInt(parts[1]);
            if (!isNaN(h) && !isNaN(m)) {
                const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (formatted !== value) onChange(formatted);
                setLocalVal(formatted);
                return;
            }
        }
        setLocalVal(value || '');
    };
    return <input type="text" className={className} value={localVal} onChange={(e) => setLocalVal(e.target.value)} onBlur={handleBlur} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} placeholder={placeholder || "--:--"} />;
};

export const AdminDashboard: React.FC<Props> = ({ jobs, logs, employees, attendance, vehicles = [], vehicleLogs = [], justifications = [], customPrompts = [], permissions = {}, onSaveJob, onSaveEmployee, onSaveJustification, onSaveAiPrompts, onSavePermissions, onUpdateLog, currentUserRole, settings, onSaveSettings, onSaveAttendance, onDeleteAttendance, onSaveVehicle, onDeleteVehicle }) => {
  const isGodMode = currentUserRole === Role.SYSTEM_ADMIN || currentUserRole === Role.DIRECTION;
  const isSystem = currentUserRole === Role.SYSTEM_ADMIN;
  
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [manageSubTab, setManageSubTab] = useState<'JOBS' | 'EMPLOYEES'>('JOBS');
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [jobSort, setJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<string | null>(null);
  const [isEditingJob, setIsEditingJob] = useState<Partial<Job> | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState<Partial<Employee> | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [tempPermissions, setTempPermissions] = useState<RolePermissions>(permissions);

  const availableTabs = useMemo(() => {
      const all = [
        {id: 'OVERVIEW', label: 'Panoramica', icon: LayoutDashboard},
        {id: 'JOBS', label: 'Analisi Commesse', icon: Briefcase},
        {id: 'HR', label: 'HR & PAGHE', icon: Users},
        {id: 'FLEET', label: 'PARCO MEZZI', icon: Truck},
        {id: 'AI', label: 'AI Analyst', icon: BrainCircuit},
        {id: 'MANAGE', label: 'GESTIONE DATI', icon: Settings},
        {id: 'CONFIG', label: 'CONFIGURAZIONE', icon: Wrench}
      ];
      if (isSystem) return all;
      const rolePerms = permissions[currentUserRole] || [];
      return all.filter(t => rolePerms.includes(t.id));
  }, [currentUserRole, permissions, isSystem]);

  useEffect(() => { if (availableTabs.length > 0 && !activeTab) setActiveTab(availableTabs[0].id); }, [availableTabs]);

  const jobStats = useMemo(() => {
    return jobs.map(job => {
      const jobLogs = logs.filter(l => l.jobId === job.id);
      const totalHoursUsed = jobLogs.reduce((acc, log) => acc + log.hours, 0);
      const totalCost = jobLogs.reduce((acc, log) => {
        const emp = employees.find(e => e.id === log.employeeId);
        return acc + (log.hours * (emp ? emp.hourlyRate : 0));
      }, 0);
      const profitMargin = job.budgetValue - totalCost;
      const marginPercentage = job.budgetValue > 0 ? (profitMargin / job.budgetValue) * 100 : 0;
      return { ...job, totalHoursUsed, totalCost, profitMargin, marginPercentage, isOverBudget: totalHoursUsed > job.budgetHours };
    });
  }, [jobs, logs, employees]);

  const sortedJobStats = useMemo(() => {
      const filtered = jobStats.filter(j => !j.isArchived && (globalSearchTerm.length < 3 || j.code.toLowerCase().includes(globalSearchTerm.toLowerCase()) || j.clientName.toLowerCase().includes(globalSearchTerm.toLowerCase())));
      if (!jobSort) return filtered;
      return [...filtered].sort((a:any, b:any) => (a[jobSort.key] < b[jobSort.key] ? (jobSort.direction === 'asc' ? -1 : 1) : (jobSort.direction === 'asc' ? 1 : -1)));
  }, [jobStats, jobSort, globalSearchTerm]);

  const requestSort = (key: string) => {
      setJobSort({ key, direction: jobSort?.key === key && jobSort.direction === 'asc' ? 'desc' : 'asc' });
  };

  // ==========================================
  // LOGICA CALCOLO ORE PERFETTA
  // ==========================================
  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { standardHours: 0, overtime: 0, isLate: false, isAnomaly: false, isAbsent: false, firstIn: null, lastOut: null, lunchOut: null, lunchIn: null, records: [], justification: null, firstInId: null, lastOutId: null };

    const overtimeSnap = settings.overtimeSnapMinutes || 30;
    const latenessSnap = 15; 
    const dayAttendance = attendance.filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr)).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);

    const parseTimeStr = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const getMinutes = (dStr: string) => { const d = new Date(dStr); return d.getHours() * 60 + d.getMinutes(); };

    const schStartM = parseTimeStr(emp.scheduleStartMorning || "08:30");
    const schEndM = parseTimeStr(emp.scheduleEndMorning || "12:30");
    const schStartA = parseTimeStr(emp.scheduleStartAfternoon || "13:30");
    const schEndA = parseTimeStr(emp.scheduleEndAfternoon || "17:30");
    const tolerance = emp.toleranceMinutes || 0;

    let firstInMins = dayAttendance[0]?.type === 'ENTRATA' ? getMinutes(dayAttendance[0].timestamp) : null;
    let lunchOutMins = dayAttendance.length >= 3 && dayAttendance[1]?.type === 'USCITA' ? getMinutes(dayAttendance[1].timestamp) : null;
    let lunchInMins = dayAttendance.length >= 3 && dayAttendance[2]?.type === 'ENTRATA' ? getMinutes(dayAttendance[2].timestamp) : null;
    let lastOutMins = dayAttendance.length >= 2 ? getMinutes(dayAttendance[dayAttendance.length - 1].timestamp) : null;
    if (dayAttendance[dayAttendance.length-1]?.type !== 'USCITA') lastOutMins = null;

    let standardHours = 0;
    let overtime = 0;
    let isLate = false;

    // Helper per inizio effettivo con snap 15m
    const getEffectiveStart = (realMins: number, schedMins: number) => {
        // Se in anticipo o entro tolleranza -> considera orario standard
        if (realMins <= schedMins + tolerance) return schedMins;
        // Fuori tolleranza -> snap al blocco di 15m successivo
        const diff = realMins - schedMins;
        const snappedDiff = Math.ceil(diff / latenessSnap) * latenessSnap;
        return schedMins + snappedDiff;
    };

    // Calcolo Mattina
    if (firstInMins !== null) {
        const effStart = getEffectiveStart(firstInMins, schStartM);
        const exitM = lunchOutMins || lastOutMins;
        if (exitM) {
            const effEnd = Math.min(exitM, schEndM);
            if (effEnd > effStart) standardHours += (effEnd - effStart) / 60;
        }
        if (firstInMins > schStartM + tolerance) isLate = true;
    }

    // Calcolo Pomeriggio
    if (lunchInMins !== null && lastOutMins !== null) {
        const effStart = getEffectiveStart(lunchInMins, schStartA);
        const effEnd = Math.min(lastOutMins, schEndA);
        if (effEnd > effStart) standardHours += (effEnd - effStart) / 60;
        if (lunchInMins > schStartA + tolerance) isLate = true;
    } else if (firstInMins !== null && lastOutMins !== null && !lunchOutMins) {
        // Turno unico (senza pausa bollata)
        if (lastOutMins > schStartA) {
            const effStartA = getEffectiveStart(Math.max(firstInMins, schStartA), schStartA);
            const effEndA = Math.min(lastOutMins, schEndA);
            if (effEndA > effStartA) standardHours += (effEndA - effStartA) / 60;
        }
    }

    // Straordinari: Solo ultima uscita vs fine orario standard (snap 30m arrotondato per difetto)
    if (lastOutMins !== null && lastOutMins > schEndA) {
        const extra = lastOutMins - schEndA;
        const snappedExtra = Math.floor(extra / overtimeSnap) * overtimeSnap;
        overtime = snappedExtra / 60;
    }

    return { 
        standardHours, overtime, isLate, justification, records: dayAttendance,
        firstIn: dayAttendance[0] ? new Date(dayAttendance[0].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lunchOut: lunchOutMins ? new Date(dayAttendance[1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lunchIn: lunchInMins ? new Date(dayAttendance[2].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lastOut: lastOutMins ? new Date(dayAttendance[dayAttendance.length-1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        firstInId: dayAttendance[0]?.id, lastOutId: dayAttendance[dayAttendance.length-1]?.id,
        isAnomaly: dateStr < new Date().toISOString().split('T')[0] && dayAttendance.length % 2 !== 0,
        isAbsent: dateStr < new Date().toISOString().split('T')[0] && dayAttendance.length === 0 && !justification && (emp.workDays || [1,2,3,4,5]).includes(new Date(dateStr).getDay())
    };
  };

  const payrollStats = useMemo(() => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let totalWorked = 0, totalOvertime = 0, lateCount = 0, daysWorked = 0;
         for(let d=1; d<=daysInMonth; d++) {
             const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
             const stats = calculateDailyStats(emp.id, dateStr);
             totalWorked += stats.standardHours; totalOvertime += stats.overtime;
             if (stats.standardHours > 0) daysWorked++;
             if (stats.isLate) lateCount++;
         }
         return { ...emp, totalWorked, totalOvertime, lateCount, daysWorked };
     });
  }, [employees, attendance, justifications, selectedMonth]);

  const handleExportSummary = () => {
    const data = payrollStats.map(stat => ({
      'Dipendente': stat.name,
      'Ruolo': stat.role,
      'Dipartimento': stat.department,
      'Giorni Lavorati': stat.daysWorked,
      'Ore Ordinarie': stat.totalWorked.toFixed(2),
      'Ore Straordinarie': stat.totalOvertime.toFixed(2),
      'Ritardi': stat.lateCount
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Riepilogo Paghe");
    writeFile(wb, `Report_Paghe_${selectedMonth}.xlsx`);
  };

  const handleTimeChange = (empId: string, dateStr: string, newTime: string, existingId: string | null, type: 'ENTRATA' | 'USCITA') => {
      if (!newTime) { if (existingId) onDeleteAttendance(existingId); return; }
      onSaveAttendance({ id: existingId || Date.now().toString(), employeeId: empId, type, timestamp: `${dateStr}T${newTime}:00` });
  };

  const handleSaveJobForm = () => { if (isEditingJob?.code) onSaveJob({ ...isEditingJob, id: isEditingJob.id || Date.now().toString(), status: isEditingJob.status || JobStatus.PLANNED } as Job); setIsEditingJob(null); };
  const handleSaveEmpForm = () => { if (isEditingEmp?.name) onSaveEmployee({ ...isEditingEmp, id: isEditingEmp.id || Date.now().toString() } as Employee); setIsEditingEmp(null); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:max-w-none bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING ? 'Amministrazione' : 'Dashboard Aziendale'}</h1>
          <p className="text-slate-500 italic uppercase text-[10px] tracking-widest font-black">Alea Sistemi Gestionale V2.5</p>
        </div>
      </div>

      <div className="border-b border-slate-200 print:hidden bg-white px-6 rounded-t-xl shadow-sm">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
               {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center"><div><p className="text-slate-400 text-xs font-bold uppercase mb-1">Commesse Attive</p><h3 className="text-2xl font-black text-slate-800">{sortedJobStats.length}</h3></div><Briefcase className="text-blue-500 bg-blue-50 p-2 rounded-lg" size={40} /></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center"><div><p className="text-slate-400 text-xs font-bold uppercase mb-1">Valore Produzione</p><h3 className="text-2xl font-black text-green-600">€ {sortedJobStats.reduce((acc, j) => acc + j.budgetValue, 0).toLocaleString()}</h3></div><TrendingUp className="text-green-500 bg-green-50 p-2 rounded-lg" size={40} /></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center"><div><p className="text-slate-400 text-xs font-bold uppercase mb-1">Ore Lavorate</p><h3 className="text-2xl font-black text-blue-600">{sortedJobStats.reduce((acc, j) => acc + j.totalHoursUsed, 0).toFixed(1)}</h3></div><Clock className="text-blue-500 bg-blue-50 p-2 rounded-lg" size={40} /></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center"><div><p className="text-slate-400 text-xs font-bold uppercase mb-1">Risultato Netto</p><h3 className="text-2xl font-black text-purple-600">€ {sortedJobStats.reduce((acc, j) => acc + j.profitMargin, 0).toLocaleString()}</h3></div><CheckCircle2 className="text-purple-500 bg-purple-50 p-2 rounded-lg" size={40} /></div>
            </div>
        )}

        {activeTab === 'JOBS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Analisi Commesse</h3>
                    <div className="relative">
                        <input type="text" placeholder="Cerca..." value={globalSearchTerm} onChange={(e) => setGlobalSearchTerm(e.target.value)} className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500"/>
                        <Search className="absolute left-3 top-2 text-slate-400" size={16}/>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th onClick={() => requestSort('code')} className="px-6 py-3 text-left cursor-pointer hover:text-blue-600">Commessa</th>
                                <th onClick={() => requestSort('clientName')} className="px-6 py-3 text-left cursor-pointer hover:text-blue-600">Cliente</th>
                                <th className="px-6 py-3 text-center">Ore</th>
                                <th className="px-6 py-3 text-center">Valore (€)</th>
                                <th className="px-6 py-3 text-center bg-blue-50/50">Risultato (€)</th>
                                <th className="px-6 py-3 text-center">Margine %</th>
                                <th className="px-6 py-3 text-center">Stato</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedJobStats.map((job) => (
                                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-black text-slate-900">{job.code}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{job.clientName}</td>
                                    <td className="px-6 py-4 text-center font-mono text-sm">{job.totalHoursUsed.toFixed(1)} / {job.budgetHours}</td>
                                    <td className="px-6 py-4 text-center font-mono text-sm">€ {job.budgetValue.toLocaleString()}</td>
                                    <td className={`px-6 py-4 text-center font-black font-mono text-sm bg-blue-50/20 ${job.profitMargin < 0 ? 'text-red-600' : 'text-green-600'}`}>€ {job.profitMargin.toLocaleString()}</td>
                                    <td className={`px-6 py-4 text-center font-bold text-sm ${job.marginPercentage < 0 ? 'text-red-600' : 'text-green-600'}`}>{job.marginPercentage.toFixed(1)}%</td>
                                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase ${job.status === JobStatus.IN_PROGRESS ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>{job.status}</span></td>
                                    <td className="px-6 py-4 text-right"><Info size={16} className="text-slate-300 hover:text-blue-500 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'HR' && (
             <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="text-blue-600" size={24}/>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="font-bold text-slate-800 border-none p-0 focus:ring-0 text-lg outline-none cursor-pointer"/>
                </div>
                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-black text-slate-800 uppercase">Riepilogo Presenze Mensile</h3><button onClick={handleExportSummary} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition">Esporta Paghe</button></div>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-3 text-left">Dipendente</th>
                                <th className="px-6 py-3 text-center">Presenze</th>
                                <th className="px-6 py-3 text-center">Ore Ordinarie</th>
                                <th className="px-6 py-3 text-center text-orange-600">Straordinari (30m)</th>
                                <th className="px-6 py-3 text-center text-red-500">Ritardi (15m)</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {payrollStats.map(stat => (
                                <tr key={stat.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900">{stat.name}<div className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{stat.department}</div></td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-600">{stat.daysWorked} gg</td>
                                    <td className="px-6 py-4 text-center font-black text-blue-700">{stat.totalWorked.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center font-black text-orange-600">{stat.totalOvertime > 0 ? stat.totalOvertime.toFixed(2) : '-'}</td>
                                    <td className="px-6 py-4 text-center">{stat.lateCount > 0 ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-black">{stat.lateCount} RITARDI</span> : <span className="text-slate-300">-</span>}</td>
                                    <td className="px-6 py-4 text-right"><button onClick={() => setSelectedEmpForDetail(stat.id)} className="text-blue-600 font-bold text-xs hover:underline uppercase tracking-widest">Gestisci</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {selectedEmpForDetail && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border-t-[8px] border-blue-600">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div><h3 className="text-2xl font-black text-slate-800">{employees.find(e => e.id === selectedEmpForDetail)?.name}</h3><p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Cartellino Bollate - {selectedMonth}</p></div>
                                <button onClick={() => setSelectedEmpForDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24}/></button>
                            </div>
                            <div className="flex-1 overflow-auto p-6">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase"><th className="p-3 border text-left">Data</th><th className="p-3 border text-center">Entrata</th><th className="p-3 border text-center">Uscita P.</th><th className="p-3 border text-center">Entrata P.</th><th className="p-3 border text-center">Uscita</th><th className="p-3 border text-center font-bold text-blue-700">Ore Ord.</th><th className="p-3 border text-center font-bold text-orange-600">Straord.</th><th className="p-3 border text-center">Stato</th></tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()}, (_, i) => i + 1).map(day => {
                                            const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                                            const stats = calculateDailyStats(selectedEmpForDetail, dateStr);
                                            const isWeekend = [0, 6].includes(new Date(dateStr).getDay());
                                            return (
                                                <tr key={day} className={`border-b ${isWeekend ? 'bg-slate-50 text-slate-400' : 'hover:bg-blue-50/20'}`}>
                                                    <td className="p-3 border font-bold text-xs">{day} <span className="text-[9px] uppercase text-slate-400">{new Date(dateStr).toLocaleDateString('it-IT', {weekday:'short'})}</span></td>
                                                    <td className="p-1 border text-center"><TimeInput className={`w-full text-center bg-transparent border-none text-xs ${stats.isLate ? 'text-red-600 font-bold' : ''}`} value={stats.firstIn || ''} onChange={(v) => handleTimeChange(selectedEmpForDetail, dateStr, v, stats.firstInId, 'ENTRATA')}/></td>
                                                    <td className="p-1 border text-center"><TimeInput className="w-full text-center bg-transparent border-none text-xs" value={stats.lunchOut || ''} onChange={(v) => handleTimeChange(selectedEmpForDetail, dateStr, v, null, 'USCITA')}/></td>
                                                    <td className="p-1 border text-center"><TimeInput className="w-full text-center bg-transparent border-none text-xs" value={stats.lunchIn || ''} onChange={(v) => handleTimeChange(selectedEmpForDetail, dateStr, v, null, 'ENTRATA')}/></td>
                                                    <td className="p-1 border text-center"><TimeInput className="w-full text-center bg-transparent border-none text-xs" value={stats.lastOut || ''} onChange={(v) => handleTimeChange(selectedEmpForDetail, dateStr, v, stats.lastOutId, 'USCITA')}/></td>
                                                    <td className="p-3 border text-center font-black text-blue-700 text-xs">{stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '-'}</td>
                                                    <td className="p-3 border text-center font-black text-orange-600 text-xs">{stats.overtime > 0 ? stats.overtime.toFixed(2) : ''}</td>
                                                    <td className="p-3 border text-center">
                                                        {stats.isLate && <span className="text-[9px] font-black text-red-500 uppercase block">RITARDO</span>}
                                                        {stats.isAnomaly && <span className="text-[9px] font-black text-orange-500 uppercase block">ANOMALIA</span>}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {activeTab === 'MANAGE' && (
            <div className="space-y-6">
                <div className="flex gap-4 mb-6">
                    <button onClick={() => setManageSubTab('JOBS')} className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition ${manageSubTab === 'JOBS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200'}`}>Commesse</button>
                    <button onClick={() => setManageSubTab('EMPLOYEES')} className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition ${manageSubTab === 'EMPLOYEES' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200'}`}>Dipendenti</button>
                </div>
                {manageSubTab === 'JOBS' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Anagrafica Commesse</h2>
                            <button onClick={() => setIsEditingJob({})} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-md"><Plus size={18} /> Nuova Commessa</button>
                        </div>
                        <table className="min-w-full divide-y divide-slate-200">
                             <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-3 text-left">Codice</th><th className="px-6 py-3 text-left">Cliente</th><th className="px-6 py-3 text-center">Budget/Valore</th><th className="px-6 py-3 text-center">Stato</th><th className="px-6 py-3"></th></tr></thead>
                             <tbody className="bg-white divide-y divide-slate-200">{sortedJobStats.map(j => (<tr key={j.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-black text-slate-800">{j.code}</td><td className="px-6 py-4 text-slate-600">{j.clientName}</td><td className="px-6 py-4 text-center font-mono text-xs">{j.budgetHours}h / €{j.budgetValue}</td><td className="px-6 py-4 text-center"><span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded">{j.status}</span></td><td className="px-6 py-4 text-right"><button onClick={() => setIsEditingJob(j)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button></td></tr>))}</tbody>
                        </table>
                    </div>
                )}
                {manageSubTab === 'EMPLOYEES' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gestione Staff</h2><button onClick={() => setIsEditingEmp({})} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition">Nuovo Dipendente</button></div>
                        {isEditingEmp && (
                            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                                <div className="bg-white p-8 rounded-3xl w-full max-w-2xl shadow-2xl border-t-[8px] border-blue-600 max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-xl font-black mb-6 uppercase">Profilo Dipendente</h3>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome e Cognome</label><input type="text" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.name || ''} onChange={e => setIsEditingEmp({...isEditingEmp, name: e.target.value})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Costo Orario (€/h)</label><input type="number" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.hourlyRate ?? ''} onChange={e => setIsEditingEmp({...isEditingEmp, hourlyRate: parseFloat(e.target.value) || 0})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Tolleranza (minuti)</label><input type="number" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.toleranceMinutes ?? 10} onChange={e => setIsEditingEmp({...isEditingEmp, toleranceMinutes: parseInt(e.target.value) || 0})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">PIN Accesso</label><input type="text" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.pin || ''} onChange={e => setIsEditingEmp({...isEditingEmp, pin: e.target.value})} /></div>
                                        <div className="col-span-2 pt-4 border-t"><h4 className="font-black text-slate-400 text-[10px] uppercase mb-4">Orario Contrattuale (Standard)</h4></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Inizio Mattina</label><input type="time" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.scheduleStartMorning || '08:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartMorning: e.target.value})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fine Mattina</label><input type="time" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.scheduleEndMorning || '12:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndMorning: e.target.value})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Inizio Pom.</label><input type="time" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.scheduleStartAfternoon || '13:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleStartAfternoon: e.target.value})} /></div>
                                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fine Pom.</label><input type="time" className="w-full border-slate-200 border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={isEditingEmp.scheduleEndAfternoon || '17:30'} onChange={e => setIsEditingEmp({...isEditingEmp, scheduleEndAfternoon: e.target.value})} /></div>
                                    </div>
                                    <div className="mt-8 flex justify-end gap-3"><button onClick={() => setIsEditingEmp(null)} className="px-6 py-2 text-slate-400 font-bold uppercase text-xs">Chiudi</button><button onClick={handleSaveEmpForm} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-200">Salva Dipendente</button></div>
                                </div>
                            </div>
                        )}
                        <table className="min-w-full divide-y divide-slate-200">
                             <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-3 text-left">Nome</th><th className="px-6 py-3 text-center">Orario Standard</th><th className="px-6 py-3 text-center">Tolleranza</th><th className="px-6 py-3"></th></tr></thead>
                             <tbody className="bg-white divide-y divide-slate-200">{employees.map(e => (<tr key={e.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-bold text-slate-800">{e.name}</td><td className="px-6 py-4 text-center font-mono text-xs">{e.scheduleStartMorning}-{e.scheduleEndAfternoon}</td><td className="px-6 py-4 text-center font-bold text-slate-500">{e.toleranceMinutes} min</td><td className="px-6 py-4 text-right"><button onClick={() => setIsEditingEmp(e)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button></td></tr>))}</tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'CONFIG' && isSystem && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Settings className="text-slate-600"/> Arrotondamenti</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <h3 className="font-black text-slate-700 uppercase text-xs mb-4">Snap Straordinari (30m)</h3>
                        <input type="number" className="w-full border-slate-300 border p-3 rounded-xl font-bold" value={settings.overtimeSnapMinutes || 30} onChange={(e) => onSaveSettings({...settings, overtimeSnapMinutes: parseInt(e.target.value)})} />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <h3 className="font-black text-slate-700 uppercase text-xs mb-4">Snap Ritardi (15m)</h3>
                        <div className="p-3 bg-white rounded-xl font-black text-blue-600 text-center text-lg border border-slate-200 shadow-inner tracking-widest">15 MINUTI</div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
