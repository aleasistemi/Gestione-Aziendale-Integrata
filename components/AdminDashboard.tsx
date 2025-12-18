
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, Job, WorkLog, AttendanceRecord, JobStatus, Role, DayJustification, JustificationType, AIQuickPrompt, RolePermissions, GlobalSettings, Vehicle, VehicleLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Briefcase, TrendingUp, AlertTriangle, Plus, Edit2, X, FileSpreadsheet, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, List, Info, Printer, Pencil, Save, Trash2, CheckSquare, Square, Settings, ArrowUp, ArrowDown, LayoutDashboard, Wrench, Filter, Scan, KeyRound, Database, Upload, MoveVertical, Star, Package, Key, Eraser, BrainCircuit, Timer, Search, Archive, RotateCcw, Truck, MapPin, User, ChevronLeft, ChevronRight, Wifi, UploadCloud } from 'lucide-react';
import { analyzeBusinessData } from '../services/geminiService';
import { read, utils, writeFile } from 'xlsx';
import { dbService } from '../services/db';

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
  const canManageEmployees = currentUserRole === Role.DIRECTION || currentUserRole === Role.SYSTEM_ADMIN;

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
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [tempPhase, setTempPhase] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  
  const [jobSort, setJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  const [manageJobSort, setManageJobSort] = useState<SortConfig>({ key: 'creationDate', direction: 'desc' });
  
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');

  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [viewArchiveYear, setViewArchiveYear] = useState<string>('active');
  const [clientSearchTerm, setClientSearchTerm] = useState(''); 
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const [isEditingVehicle, setIsEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [isWritingNfc, setIsWritingNfc] = useState<Partial<Employee> | null>(null);
  const [nfcWriteStatus, setNfcWriteStatus] = useState<'IDLE'|'WRITING'|'SUCCESS'|'ERROR'>('IDLE');
  
  const [fleetCurrentMonth, setFleetCurrentMonth] = useState(new Date());
  const [fleetSelectedDate, setFleetSelectedDate] = useState<string | null>(null);

  useEffect(() => {
     if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
         setActiveTab(availableTabs[0].id);
     }
  }, [currentUserRole, permissions, availableTabs]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [tempPromptText, setTempPromptText] = useState('');
  const [tempPromptLabel, setTempPromptLabel] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<string | null>(null);

  const [isEditingJob, setIsEditingJob] = useState<Partial<Job> | null>(null);
  const [isEditingEmp, setIsEditingEmp] = useState<Partial<Employee> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [tempPermissions, setTempPermissions] = useState<RolePermissions>(permissions);

  const availableArchiveYears = useMemo(() => {
      const years = new Set<number>();
      jobs.filter(j => j.isArchived).forEach(j => {
          if (j.archiveYear) years.add(j.archiveYear);
      });
      return Array.from(years).sort((a,b) => b - a);
  }, [jobs]);

  const uniqueClients = useMemo(() => {
      return Array.from(new Set(jobs.map(j => j.clientName))).sort();
  }, [jobs]);

  const handleWriteNfc = async (emp: Employee) => {
      setIsWritingNfc(emp);
      setNfcWriteStatus('IDLE');

      if ('NDEFReader' in window) {
          try {
              const ndef = new window.NDEFReader();
              await ndef.scan(); 
              setNfcWriteStatus('WRITING');
              
              const codeToWrite = emp.nfcCode || emp.nfcCode2 || emp.id;
              
              await (ndef as any).write({
                  records: [{ recordType: "text", data: codeToWrite }]
              });
              
              setNfcWriteStatus('SUCCESS');
              setTimeout(() => {
                  setIsWritingNfc(null);
                  setNfcWriteStatus('IDLE');
              }, 2000);

          } catch (error) {
              console.error(error);
              setNfcWriteStatus('ERROR');
          }
      } else {
          alert("NFC non supportato su questo dispositivo. Usa un telefono Android.");
          setIsWritingNfc(null);
      }
  }

  const filteredLogsInDateRange = useMemo(() => {
      if (!filterStartDate && !filterEndDate) return logs;
      return logs.filter(l => {
          const logDate = l.date;
          const isAfterStart = !filterStartDate || logDate >= filterStartDate;
          const isBeforeEnd = !filterEndDate || logDate <= filterEndDate;
          return isAfterStart && isBeforeEnd;
      });
  }, [logs, filterStartDate, filterEndDate]);

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
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastPhase = lastLog ? lastLog.phase : '-';

      return { ...job, totalHoursUsed, totalCost, profitMargin, isOverBudget, startDate, lastPhase };
    });
  }, [jobs, logs, employees]);

  const overviewJobStats = useMemo(() => {
      const relevantJobIds = new Set(filteredLogsInDateRange.map(l => l.jobId));
      jobs.forEach(j => {
          if ((!filterStartDate || (j.creationDate && j.creationDate >= filterStartDate)) && 
              (!filterEndDate || (j.creationDate && j.creationDate <= filterEndDate))) {
              relevantJobIds.add(j.id);
          }
      });
      const relevantJobs = jobStats.filter(j => relevantJobIds.has(j.id) && !j.isArchived);
      return relevantJobs;
  }, [jobStats, filteredLogsInDateRange, filterStartDate, filterEndDate, jobs]);


  const filterJobsForTable = (jobList: typeof jobStats, isManageTable: boolean) => {
      return jobList.filter(j => {
          if (isManageTable) {
              if (viewArchiveYear === 'active') {
                  if (j.isArchived) return false;
              } else {
                  if (!j.isArchived || j.archiveYear !== parseInt(viewArchiveYear)) return false;
              }
          } else {
              if (j.isArchived) return false;
          }

          if (globalSearchTerm.length >= 3) {
              const searchLower = globalSearchTerm.toLowerCase();
              const matchesCode = j.code.toLowerCase().includes(searchLower);
              const matchesClient = j.clientName.toLowerCase().includes(searchLower);
              if (!matchesCode && !matchesClient) return false;
          }

          if (filterStartDate && j.startDate !== '-' && j.startDate < filterStartDate) return false;
          if (filterEndDate && j.startDate !== '-' && j.startDate > filterEndDate) return false;

          return true;
      });
  };

  const sortData = (data: any[], config: SortConfig) => {
      if (!config) return data;
      return [...data].sort((a, b) => {
          let valA = a[config.key];
          let valB = b[config.key];
          if (config.key === 'creationDate' || config.key === 'deadline' || config.key === 'startDate') {
              valA = valA || ''; valB = valB || '';
          }
          if (valA < valB) return config.direction === 'asc' ? -1 : 1;
          if (valA > valB) return config.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const filteredJobStats = useMemo(() => filterJobsForTable(jobStats, false), [jobStats, filterStartDate, filterEndDate, globalSearchTerm]);
  const sortedJobStats = useMemo(() => sortData(filteredJobStats, jobSort), [filteredJobStats, jobSort]);
  
  const manageFilteredStats = useMemo(() => filterJobsForTable(jobStats, true), [jobStats, filterStartDate, filterEndDate, globalSearchTerm, viewArchiveYear]);
  const sortedManageJobs = useMemo(() => sortData(manageFilteredStats, manageJobSort), [manageFilteredStats, manageJobSort]); 

  const requestSort = (key: string, currentSort: SortConfig, setSort: any) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (currentSort && currentSort.key === key && currentSort.direction === 'asc') { direction = 'desc'; }
      setSort({ key, direction });
  }

  const renderSortArrow = (key: string, currentSort: SortConfig) => {
      if (!currentSort || currentSort.key !== key) return <span className="text-slate-300 ml-1">↕</span>;
      return currentSort.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1"/> : <ArrowDown size={14} className="inline ml-1"/>;
  }
  
  const clientData = useMemo(() => {
    const data: {[key: string]: number} = {};
    filteredLogsInDateRange.forEach(log => {
      const job = jobs.find(j => j.id === log.jobId);
      if (job) {
          data[job.clientName] = (data[job.clientName] || 0) + log.hours;
      }
    });
    return Object.keys(data).map(key => ({ name: key, hours: data[key] }));
  }, [filteredLogsInDateRange, jobs]);

  const statusData = useMemo(() => {
    const counts: {[key: string]: number} = {};
    overviewJobStats.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [overviewJobStats]);

  const topClientsByRevenue = useMemo(() => {
      const map: {[key:string]: number} = {};
      overviewJobStats.forEach(j => {
          map[j.clientName] = (map[j.clientName] || 0) + j.budgetValue;
      });
      return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [overviewJobStats]);

  const overBudgetClients = useMemo(() => {
      const map: {[key:string]: {over: number, total: number}} = {};
      overviewJobStats.filter(j => j.isOverBudget).forEach(j => {
          if (!map[j.clientName]) map[j.clientName] = {over: 0, total: 0};
          map[j.clientName].over += (j.totalHoursUsed - j.budgetHours);
          map[j.clientName].total += j.totalHoursUsed;
      });
      return Object.entries(map).sort((a,b) => b[1].over - a[1].over).slice(0, 5);
  }, [overviewJobStats]);

  const packagingJobs = useMemo(() => {
      return overviewJobStats.filter(j => j.status === JobStatus.IN_PROGRESS && j.lastPhase.toLowerCase().includes('imballaggio'));
  }, [overviewJobStats]);

  const phaseEfficiency = useMemo(() => {
      const map: {[phase:string]: {[emp:string]: number}} = {};
      filteredLogsInDateRange.forEach(l => {
          const empName = employees.find(e => e.id === l.employeeId)?.name || 'Unknown';
          if (!map[l.phase]) map[l.phase] = {};
          map[l.phase][empName] = (map[l.phase][empName] || 0) + l.hours;
      });
      return Object.entries(map).map(([phase, emps]) => {
          const topEmp = Object.entries(emps).sort((a,b) => b[1] - a[1])[0];
          return { phase, champion: topEmp[0], hours: topEmp[1] };
      });
  }, [filteredLogsInDateRange, employees]);

  const expiringJobs = useMemo(() => {
      return overviewJobStats
        .filter(j => j.status === JobStatus.IN_PROGRESS && j.deadline)
        .sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 5);
  }, [overviewJobStats]);

  const activeOperators = useMemo(() => {
     const map: {[id:string]: number} = {};
     filteredLogsInDateRange.forEach(l => {
         map[l.employeeId] = (map[l.employeeId] || 0) + l.hours;
     });
     return Object.entries(map)
        .map(([id, hours]) => ({ name: employees.find(e=>e.id===id)?.name || 'Unknown', hours }))
        .sort((a,b) => b.hours - a.hours)
        .slice(0, 5);
  }, [filteredLogsInDateRange, employees]);

  const recentActivities = useMemo(() => {
      return [...filteredLogsInDateRange]
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(l => ({
            ...l,
            empName: employees.find(e => e.id === l.employeeId)?.name,
            jobCode: jobs.find(j => j.id === l.jobId)?.code
        }));
  }, [filteredLogsInDateRange, employees, jobs]);

  const handleAskAI = async (promptText: string = aiPrompt) => {
    if (!promptText.trim()) return;
    setAiPrompt(promptText);
    setIsLoadingAi(true);
    setAiResponse('');
    const context = { jobs: jobStats, logs, employees };
    try {
        const result = await analyzeBusinessData(promptText, context);
        setAiResponse(result);
    } catch (e) {
        setAiResponse("Errore durante l'analisi AI.");
    } finally {
        setIsLoadingAi(false);
    }
  };

  const handleSavePrompt = (id: string) => {
      const updated = customPrompts.map(p => p.id === id ? { ...p, label: tempPromptLabel, prompt: tempPromptText } : p);
      onSaveAiPrompts(updated);
      setEditingPromptId(null);
  };
  
  const handleExcelExportJobs = (sourceData: typeof jobStats) => {
      const jobsToExport = selectedJobIds.size > 0 
        ? sourceData.filter(j => selectedJobIds.has(j.id))
        : sourceData;

      const data = jobsToExport.map(j => ({
          'Codice': j.code,
          'Cliente': j.clientName,
          'Descrizione': j.description,
          'Stato': j.status,
          'Budget Ore': j.budgetHours,
          'Ore Usate': j.totalHoursUsed,
          'Valore Commessa': j.budgetValue,
          'Margine': j.profitMargin,
          'Scadenza': j.deadline,
          'Data Inizio': j.creationDate || j.startDate, 
          'Priorità': j.priority || 3,
          'Archiviata': j.isArchived ? `Sì (${j.archiveYear})` : 'No'
      }));

      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Commesse");
      writeFile(workbook, `Report_Commesse_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleBackupDownload = async () => {
    const data = await dbService.exportDatabase();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBackupRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    const success = await dbService.importDatabase(text);
    if(success) {
        alert("Backup ripristinato con successo! La pagina verrà ricaricata.");
        window.location.reload();
    } else {
        alert("Errore nel ripristino del backup. File non valido.");
    }
  };

  const handleCloudBackupTest = async () => {
      if (!settings.backupWebhookUrl) {
          alert("Inserisci prima un URL Webhook valido (Pabbly/Zapier).");
          return;
      }
      try {
          const data = await dbService.exportDatabase();
          
          const blob = new Blob([data], { type: 'application/json' });
          const filename = `backup_alea_${new Date().toISOString().split('T')[0]}.json`;
          const formData = new FormData();
          
          formData.append('file', blob, filename);

          await fetch(settings.backupWebhookUrl, {
              method: 'POST',
              body: formData
          });
          alert("Backup inviato correttamente al Webhook! Controlla Pabbly.");
      } catch (e) {
          alert("Errore invio backup: " + e);
      }
  }

  const handleResetJobs = async () => {
      if (window.confirm("ATTENZIONE: Stai per eliminare TUTTE le commesse e le registrazioni delle ore lavorate.\n\nQuesta azione NON è reversibile.\n\nSei sicuro di voler procedere per pulire l'archivio?")) {
          try {
              await dbService.resetJobsAndLogs();
              alert("Archivio pulito con successo. La pagina verrà ricaricata.");
              window.location.reload();
          } catch(e) {
              alert("Errore durante la pulizia. Controlla la console.");
          }
      }
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws, { header: 1 }); 

          const jobsBatchMap = new Map<string, Job>();
          const empsBatchMap = new Map<string, Employee>();
          const logsBatchList: WorkLog[] = [];
          const codeToIdMap = new Map<string, string>(); 

          let jobsCreated = 0; let jobsUpdated = 0; let logsCreated = 0;
          let lastJobId: string | null = null;

          let headerIndex = -1;
          for(let i=0; i<Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if(row.some(cell => cell && cell.toString().trim().toLowerCase() === 'riferimento')) {
                  headerIndex = i;
                  break;
              }
          }
          if(headerIndex === -1) { alert("Intestazione 'Riferimento' non trovata."); return; }

          const headerRow = data[headerIndex] as string[];
          const colMap: {[key:string]: number} = {};
          headerRow.forEach((cell, idx) => { if(typeof cell === 'string') colMap[cell.trim()] = idx; });
          const getCol = (row: any[], name: string) => { const idx = colMap[name]; return (idx !== undefined && row[idx] !== undefined) ? row[idx] : null; }
          
          const formatDate = (val: any) => {
              if(!val) return '';
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (typeof val === 'number') {
                  const d = new Date(Math.round((val - 25569)*86400*1000));
                  return d.toISOString().split('T')[0];
              }
              if (typeof val === 'string') {
                  if (val.includes('.')) {
                    const parts = val.split('.');
                    if (parts.length === 3) {
                        let year = parseInt(parts[2]);
                        if (year < 100) year += 2000;
                        return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                  }
                  if (val.includes('/')) {
                      const parts = val.split('/');
                      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                  }
              }
              return '';
          }

          for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (row.length === 0) continue;
              const code = getCol(row, 'Riferimento');
              const operatorRaw = getCol(row, 'Operatore');
              if (!operatorRaw) continue; 

              if (code) {
                  const cleanCode = String(code).trim();
                  let existingJob = jobs.find(j => j.code === cleanCode);
                  if (!existingJob) {
                      const batchId = codeToIdMap.get(cleanCode);
                      if (batchId) existingJob = jobsBatchMap.get(batchId);
                  }
                  let jobId: string;
                  if (existingJob) {
                      jobId = existingJob.id;
                      if (!jobsBatchMap.has(jobId)) jobsUpdated++;
                  } else {
                      jobId = Date.now().toString() + Math.random().toString().slice(2,5);
                      codeToIdMap.set(cleanCode, jobId);
                      jobsCreated++;
                  }
                  
                  let rawStartDate = getCol(row, 'Data Inizio');
                  if (!rawStartDate && row.length > 11) rawStartDate = row[11];

                  const jobData: Job = {
                      id: jobId,
                      code: cleanCode,
                      clientName: String(getCol(row, 'Cliente') || 'Sconosciuto'),
                      description: String(getCol(row, 'Descrizione') || ''),
                      status: existingJob ? existingJob.status : JobStatus.IN_PROGRESS,
                      budgetHours: Number(getCol(row, 'Monte Ore') || 0),
                      budgetValue: Number(getCol(row, 'Valore') || 0),
                      deadline: formatDate(getCol(row, 'Data Consegna')),
                      creationDate: formatDate(rawStartDate) || (existingJob ? existingJob.creationDate : new Date().toISOString().split('T')[0]),
                      priority: existingJob ? (existingJob.priority || 3) : 3,
                      suggestedOperatorId: existingJob?.suggestedOperatorId
                  };
                  jobsBatchMap.set(jobId, jobData);
                  lastJobId = jobId;
              }

              if (lastJobId && operatorRaw) {
                  const operatorName = String(operatorRaw).trim();
                  let emp = employees.find(e => e.name.toLowerCase().includes(operatorName.toLowerCase()));
                  if (!emp) {
                      for (const batchEmp of empsBatchMap.values()) {
                          if (batchEmp.name.toLowerCase() === operatorName.toLowerCase()) {
                              emp = batchEmp;
                              break;
                          }
                      }
                  }
                  if (!emp) {
                      const newEmpId = 'imp-' + Date.now() + Math.random().toString().slice(2,5);
                      emp = {
                          id: newEmpId,
                          name: operatorName,
                          role: Role.WORKSHOP,
                          hourlyRate: 30,
                          department: 'Importato',
                          toleranceMinutes: 10,
                          scheduleStartMorning: "08:30",
                          scheduleEndMorning: "12:30",
                          scheduleStartAfternoon: "13:30",
                          scheduleEndAfternoon: "17:30",
                          workDays: [1,2,3,4,5]
                      };
                      empsBatchMap.set(newEmpId, emp);
                  }
                  const hoursRaw = getCol(row, 'Ore');
                  let hours = 0;
                  if (typeof hoursRaw === 'number') hours = hoursRaw * 24;
                  else if (typeof hoursRaw === 'string' && hoursRaw.includes(':')) {
                      const [h, m] = hoursRaw.split(':').map(Number);
                      hours = h + (m/60);
                  }
                  if (hours > 0) {
                       const logDate = formatDate(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0];
                       const logId = `log-${lastJobId}-${emp.id}-${logDate}-${hours.toFixed(2)}`;
                       const existsInDb = logs.some(l => l.id === logId);
                       const existsInBatch = logsBatchList.some(l => l.id === logId);
                       if (!existsInDb && !existsInBatch) {
                           logsBatchList.push({
                               id: logId,
                               jobId: lastJobId,
                               employeeId: emp.id,
                               date: logDate,
                               hours: hours,
                               phase: 'Generica (Import)',
                               notes: 'Importato da Excel'
                           });
                           logsCreated++;
                       }
                  }
              }
          }
          if (jobsBatchMap.size > 0 || logsBatchList.length > 0) {
              try {
                  await dbService.bulkImport(Array.from(jobsBatchMap.values()), logsBatchList, Array.from(empsBatchMap.values()));
                  alert(`Importazione Completata!\nNuove: ${jobsCreated}, Aggiornate: ${jobsUpdated}, Log: ${logsCreated}`);
                  window.location.reload();
              } catch (e) { alert("Errore salvataggio dati."); }
          } else { alert("Nessun dato valido."); }
      };
      reader.readAsBinaryString(file);
  };

  const addPhase = () => {
      if (newPhaseName && !settings.workPhases.includes(newPhaseName)) {
          const newPhases = [...settings.workPhases, newPhaseName];
          onSaveSettings({...settings, workPhases: newPhases});
          setNewPhaseName('');
      }
  }

  const removePhase = (phaseToRemove: string) => {
      if (confirm(`Sei sicuro di voler eliminare la fase "${phaseToRemove}"?`)) {
          const newPhases = settings.workPhases.filter(p => p !== phaseToRemove);
          onSaveSettings({...settings, workPhases: newPhases});
      }
  }

  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { standardHours: 0, overtime: 0, isLate: false, isAnomaly: false, isAbsent: false, firstIn: null, lastOut: null, lunchOut: null, lunchIn: null, records: [], justification: null, firstInId: null, lunchOutId: null, lunchInId: null, lastOutId: null };

    const overtimeSnap = settings.overtimeSnapMinutes || 30;
    const permessoSnap = settings.permessoSnapMinutes || 15;
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); 
    const todayStr = new Date().toISOString().split('T')[0];
    const isWorkDay = (emp.workDays || [1,2,3,4,5]).includes(dayOfWeek);
    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    
    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let firstIn = null, firstInId = null, firstInMins = 0;
    let lunchOut = null, lunchOutId = null, lunchOutMins = 0;
    let lunchIn = null, lunchInId = null, lunchInMins = 0;
    let lastOut = null, lastOutId = null, lastOutMins = 0;

    const getMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
    
    const parseTimeStr = (t: string | undefined | null) => { 
        if (!t) return 0;
        const parts = t.split(':');
        if (parts.length < 2) return 0;
        const [h, m] = parts.map(Number); 
        if (isNaN(h) || isNaN(m)) return 0;
        return h * 60 + m; 
    };

    if (dayAttendance.length > 0 && dayAttendance[0].type === 'ENTRATA') {
        const d = new Date(dayAttendance[0].timestamp);
        firstIn = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        firstInMins = getMinutes(d);
        firstInId = dayAttendance[0].id;
    }
    
    if (dayAttendance.length >= 2 && dayAttendance[1].type === 'USCITA') {
         const d = new Date(dayAttendance[1].timestamp);
         if (dayAttendance.length >= 3) {
             lunchOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             lunchOutMins = getMinutes(d);
             lunchOutId = dayAttendance[1].id;
         } else {
             lastOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
             lastOutMins = getMinutes(d);
             lastOutId = dayAttendance[1].id;
         }
    }
    if (dayAttendance.length >= 3 && dayAttendance[2].type === 'ENTRATA') {
        const d = new Date(dayAttendance[2].timestamp);
        lunchIn = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        lunchInMins = getMinutes(d);
        lunchInId = dayAttendance[2].id;
    }
    if (dayAttendance.length >= 4 && dayAttendance[3].type === 'USCITA') {
        const d = new Date(dayAttendance[3].timestamp);
        lastOut = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        lastOutMins = getMinutes(d);
        lastOutId = dayAttendance[3].id;
    }

    let standardHours = 0;
    let overtime = 0;
    const schStartM = parseTimeStr(emp.scheduleStartMorning || "08:30");
    const schEndM = parseTimeStr(emp.scheduleEndMorning || "12:30");
    const schStartA = parseTimeStr(emp.scheduleStartAfternoon || "13:30");
    const schEndA = parseTimeStr(emp.scheduleEndAfternoon || "17:30");

    if (firstIn && (lunchOut || lastOut)) {
        const exitMins = lunchOut ? lunchOutMins : lastOutMins; 
        const effectiveStart = Math.max(firstInMins, schStartM);
        const effectiveEnd = Math.min(exitMins, schEndM);
        if (effectiveEnd > effectiveStart) standardHours += (effectiveEnd - effectiveStart) / 60;
    }

    if (lunchIn && lastOut) {
        const effectiveStart = Math.max(lunchInMins, schStartA);
        let effectiveEnd = lastOutMins;
        if (lastOutMins < schEndA) {
            const rawMissing = schEndA - lastOutMins;
            const deductionMinutes = Math.ceil(rawMissing / permessoSnap) * permessoSnap;
            effectiveEnd = schEndA - deductionMinutes;
        } else {
            effectiveEnd = schEndA;
        }
        if (effectiveEnd > effectiveStart) standardHours += (effectiveEnd - effectiveStart) / 60;
        if (lastOutMins > schEndA) {
            const diffMinutes = lastOutMins - schEndA;
            const blocks = Math.floor(diffMinutes / overtimeSnap);
            overtime += blocks * (overtimeSnap / 60);
        }
    } else if (!lunchOut && firstIn && lastOut) {
        if (lastOutMins > schEndA) {
             const diffMinutes = lastOutMins - schEndA;
             const blocks = Math.floor(diffMinutes / overtimeSnap);
             overtime += blocks * (overtimeSnap / 60);
        }
    }

    let isLate = false, isAnomaly = false, isAbsent = false;
    if (firstIn && !justification) {
        const limitMinutes = schStartM + (emp.toleranceMinutes || 10);
        if (firstInMins > limitMinutes) isLate = true;
    }
    if (dateStr < todayStr && dayAttendance.length % 2 !== 0) isAnomaly = true;
    if (dateStr < todayStr && isWorkDay && dayAttendance.length === 0 && !justification) isAbsent = true;

    return { standardHours, overtime, isLate, isAnomaly, isAbsent, firstIn, lunchOut, lunchIn, lastOut, firstInId, lunchOutId, lunchInId, lastOutId, records: dayAttendance, justification };
  };

  const getPayrollData = () => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let totalWorked = 0, totalOvertime = 0, ferieCount = 0, malattiaCount = 0, permessoHours = 0, lateCount = 0, absenceCount = 0, daysWorked = 0;
         for(let d=1; d<=daysInMonth; d++) {
             const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
             const stats = calculateDailyStats(emp.id, dateStr);
             totalWorked += stats.standardHours;
             totalOvertime += stats.overtime;
             if (stats.standardHours > 0) daysWorked++;
             if (stats.isLate) lateCount++;
             if (stats.isAbsent) absenceCount++;
             if (stats.justification) {
                 if (stats.justification.type === JustificationType.FERIE) ferieCount++;
                 if (stats.justification.type === JustificationType.MALATTIA) malattiaCount++;
                 if (stats.justification.type === JustificationType.PERMESSO) permessoHours += (stats.justification.hoursOffset || 0);
             }
         }
         return { ...emp, totalWorked, totalOvertime, ferieCount, malattiaCount, permessoHours, lateCount, absenceCount, daysWorked };
     });
  };

  const handleTimeChange = (empId: string, dateStr: string, newTime: string, existingId: string | null, type: 'ENTRATA' | 'USCITA') => {
      if (!newTime) { if (existingId) onDeleteAttendance(existingId); return; }
      const record: AttendanceRecord = { id: existingId || Date.now().toString() + Math.random().toString().slice(2,5), employeeId: empId, type: type, timestamp: `${dateStr}T${newTime}:00` };
      onSaveAttendance(record);
  }
  const setJustificationForDay = (empId: string, dateStr: string, type: JustificationType, hours: number = 0) => { onSaveJustification({ id: `${empId}-${dateStr}`, employeeId: empId, date: dateStr, type, hoursOffset: hours }); };
  
  const handleSaveJobForm = () => { 
      if (!isEditingJob?.code) return; 
      onSaveJob({
          ...isEditingJob, 
          id: isEditingJob.id || Date.now().toString(), 
          status: isEditingJob.status || JobStatus.PLANNED, 
          priority: isEditingJob.priority || 3,
          creationDate: isEditingJob.creationDate || new Date().toISOString().split('T')[0] 
      } as Job); 
      setIsEditingJob(null); 
  };

  const handleSaveVehicleForm = () => {
      if (!isEditingVehicle?.name || !onSaveVehicle) return;
      onSaveVehicle({
          id: isEditingVehicle.id || Date.now().toString(),
          name: isEditingVehicle.name,
          plate: isEditingVehicle.plate || '',
          status: isEditingVehicle.status || 'AVAILABLE',
          currentDriverId: isEditingVehicle.currentDriverId,
          lastCheckOut: isEditingVehicle.lastCheckOut
      });
      setIsEditingVehicle(null);
  }

  const handleDeleteVehicle = (id: string) => {
      if (confirm("Sei sicuro di voler eliminare questo mezzo?") && onDeleteVehicle) {
          onDeleteVehicle(id);
      }
  }

  const handleArchiveJob = (job: Job) => {
      if (confirm(`Vuoi archiviare la commessa ${job.code}? Sparirà dalla lista principale ma rimarrà nei report.`)) {
          const archiveYear = new Date().getFullYear();
          onSaveJob({ ...job, isArchived: true, archiveYear });
      }
  };

  const handleRestoreJob = (job: Job) => {
      if (confirm(`Vuoi ripristinare la commessa ${job.code}?`)) {
          onSaveJob({ ...job, isArchived: false, archiveYear: undefined });
      }
  }

  const handleSaveEmpForm = () => { if (!isEditingEmp?.name) return; onSaveEmployee({...isEditingEmp, id: isEditingEmp.id || Date.now().toString(), scheduleStartMorning: isEditingEmp.scheduleStartMorning || "08:30", scheduleEndMorning: isEditingEmp.scheduleEndMorning || "12:30", scheduleStartAfternoon: isEditingEmp.scheduleStartAfternoon || "13:30", scheduleEndAfternoon: isEditingEmp.scheduleEndAfternoon || "17:30", toleranceMinutes: isEditingEmp.toleranceMinutes || 10, workDays: isEditingEmp.workDays || [1,2,3,4,5]} as Employee); setIsEditingEmp(null); }
  const handleBulkStatusChange = (status: JobStatus) => { selectedJobIds.forEach(id => { const job = jobs.find(j => j.id === id); if (job) onSaveJob({ ...job, status }); }); setSelectedJobIds(new Set()); }
  const handleUpdatePhase = (log: WorkLog) => { onUpdateLog({ ...log, phase: tempPhase }); setEditingLogId(null); setTempPhase(''); }
  const togglePermission = (role: string, tabId: string) => { const currentTabs = tempPermissions[role] || []; setTempPermissions({ ...tempPermissions, [role]: currentTabs.includes(tabId) ? currentTabs.filter(t => t !== tabId) : [...currentTabs, tabId] }); }
  const savePermissions = () => { onSavePermissions(tempPermissions); alert("Permessi aggiornati!"); }
  
  const payrollStats = useMemo(() => getPayrollData(), [employees, attendance, justifications, selectedMonth]);

  const handleExportSummary = () => {
      const data = payrollStats.map(stat => ({
          'Dipendente': stat.name,
          'Ruolo': stat.role,
          'Giorni Presenza': stat.daysWorked,
          'Ore Ordinarie': stat.totalWorked.toFixed(2),
          'Straordinari': stat.totalOvertime.toFixed(2),
          'Ferie (gg)': stat.ferieCount,
          'Malattia (gg)': stat.malattiaCount,
          'Permessi (h)': stat.permessoHours,
          'Assenze Ingiustificate': stat.absenceCount,
          'Ritardi': stat.lateCount
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Riepilogo Paghe");
      writeFile(wb, `Riepilogo_Paghe_${selectedMonth}.xlsx`);
  };

  const handleExportTimecard = (empId: string) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const rows = [];
      
      for(let d=1; d<=daysInMonth; d++) {
          const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
          const stats = calculateDailyStats(emp.id, dateStr);
          rows.push({
              'Data': dateStr,
              'Entrata': stats.firstIn || '',
              'Uscita Pausa': stats.lunchOut || '',
              'Rientro Pausa': stats.lunchIn || '',
              'Uscita': stats.lastOut || '',
              'Ore Ordinarie': stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '',
              'Straordinari': stats.overtime > 0 ? stats.overtime.toFixed(2) : '',
              'Giustificativo': stats.justification ? stats.justification.type : '',
              'Note': [stats.isLate ? 'RITARDO' : '', stats.isAbsent ? 'ASSENZA' : '', stats.isAnomaly ? 'ANOMALIA' : ''].filter(Boolean).join(', ')
          });
      }

      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, `Cartellino_${emp.name.replace(/\s+/g, '_')}`);
      writeFile(wb, `Cartellino_${emp.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:max-w-none bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING ? 'Pannello Amministrazione' : 'Dashboard Aziendale'}</h1>
          <p className="text-slate-500">
              {(currentUserRole === Role.ADMIN || currentUserRole === Role.ACCOUNTING) && 'Gestione Presenze e Paghe'}
              {currentUserRole === Role.DIRECTION && 'Business Intelligence Completa'}
              {currentUserRole === Role.SYSTEM_ADMIN && 'Pannello di Controllo Sistemista'}
              {currentUserRole !== Role.SYSTEM_ADMIN && currentUserRole !== Role.DIRECTION && currentUserRole !== Role.ADMIN && 'Gestione Commesse e Clienti'}
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200 print:hidden bg-white px-6 rounded-t-xl">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              {tab.icon && <tab.icon size={16}/>} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'OVERVIEW' && (
             <>
            <div className="flex justify-between items-center mb-6 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    <Filter size={18} /> <span className="font-semibold text-sm">Filtra Report per Data:</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded border border-slate-200">
                        <Calendar size={14} className="text-slate-400"/>
                        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-32"/>
                        <span className="text-slate-300">-</span>
                        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-transparent outline-none text-slate-600 w-32"/>
                        {(filterStartDate || filterEndDate) && <button onClick={() => {setFilterStartDate(''); setFilterEndDate('')}}><X size={14}/></button>}
                    </div>
