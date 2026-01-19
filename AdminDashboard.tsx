
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
      
      return [];
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

  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
      if (availableTabs.length > 0) {
          if (!activeTab || !availableTabs.find(t => t.id === activeTab)) {
              setActiveTab(availableTabs[0].id);
          }
      } else {
          setActiveTab(null);
      }
  }, [currentUserRole, permissions, availableTabs]);

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
      const marginPercentage = job.budgetValue > 0 ? (profitMargin / job.budgetValue) * 100 : 0;

      const sortedLogs = [...jobLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const startDate = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length-1].date : job.creationDate || '-';
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastPhase = lastLog ? lastLog.phase : '-';

      return { ...job, totalHoursUsed, totalCost, profitMargin, marginPercentage, isOverBudget, startDate, lastPhase };
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
        .sort((a,b) => new Date(a.deadline).getTime() - new Date(a.deadline).getTime())
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
    if (!settings.geminiApiKey) {
        alert("Per utilizzare AI Analyst, devi prima inserire una API Key valida nella sezione CONFIGURAZIONE.");
        return;
    }
    if (!promptText.trim()) return;
    setAiPrompt(promptText);
    setIsLoadingAi(true);
    setAiResponse('');
    const context = { jobs: jobStats, logs, employees };
    try {
        const result = await analyzeBusinessData(promptText, context, settings.geminiApiKey);
        setAiResponse(result);
    } catch (e) {
        setAiResponse("Errore durante l'analisi. Verifica la tua API Key.");
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

  const handleResetFleet = async () => {
      if (window.confirm("Sei sicuro di voler ripulire tutto lo storico dei mezzi e resettare lo stato di tutti i veicoli a 'Disponibile'?")) {
          try {
              await dbService.resetFleetLogs();
              alert("Registro mezzi ripulito con successo. La pagina verrà ricaricata.");
              window.location.reload();
          } catch(e) {
              alert("Errore durante il reset del parco mezzi.");
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
          
          let jobsCreated = 0; let jobsUpdated = 0; let logsCreated = 0;
          let lastJobContext: { id: string, code: string } | null = null;

          let headerIndex = -1;
          for(let i=0; i<Math.min(data.length, 50); i++) {
              const row = data[i] as any[];
              if(row && row.some(cell => cell && cell.toString().trim().toLowerCase() === 'riferimento')) {
                  headerIndex = i;
                  break;
              }
          }
          
          if(headerIndex === -1) { 
              alert("Intestazione 'Riferimento' non trovata. Assicurati che il file abbia le colonne corrette."); 
              return; 
          }

          const headerRow = data[headerIndex] as string[];
          const colMap: {[key:string]: number} = {};
          headerRow.forEach((cell, idx) => { 
              if(cell) colMap[cell.toString().trim().toLowerCase()] = idx; 
          });

          const getCol = (row: any[], name: string) => { 
              const idx = colMap[name.toLowerCase()]; 
              return (idx !== undefined && row[idx] !== undefined && row[idx] !== null) ? row[idx] : null; 
          };
          
          const formatDateStr = (val: any) => {
              if(!val) return '';
              if (val instanceof Date) return val.toISOString().split('T')[0];
              const s = String(val).trim();
              const parts = s.split(/[./-]/);
              if (parts.length === 3) {
                  let day = parts[0].padStart(2, '0');
                  let month = parts[1].padStart(2, '0');
                  let year = parts[2];
                  if (year.length === 2) year = "20" + year;
                  return `${year}-${month}-${day}`;
              }
              return '';
          };

          const parseHours = (val: any) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string' && val.includes(':')) {
                  const [h, m] = val.split(':').map(Number);
                  return (h || 0) + (m || 0) / 60;
              }
              return Number(val) || 0;
          };

          for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0) continue;
              
              const codeRaw = getCol(row, 'Riferimento');
              const operatorRaw = getCol(row, 'Operatore');
              const hoursRaw = getCol(row, 'Ore');

              if (codeRaw && String(codeRaw).trim() !== "") {
                  const code = String(codeRaw).trim();
                  let existingJob = jobs.find(j => j.code === code) || Array.from(jobsBatchMap.values()).find(j => j.code === code);
                  
                  let jobId: string;
                  if (existingJob) {
                      jobId = existingJob.id;
                      if (!jobsBatchMap.has(jobId)) jobsUpdated++;
                  } else {
                      jobId = "job-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
                      jobsCreated++;
                  }

                  const jobData: Job = {
                      id: jobId,
                      code: code,
                      clientName: String(getCol(row, 'Cliente') || 'Sconosciuto'),
                      description: String(getCol(row, 'Descrizione') || ''),
                      status: existingJob?.status || JobStatus.IN_PROGRESS,
                      budgetHours: Number(getCol(row, 'Monte Ore') || 0),
                      budgetValue: Number(getCol(row, 'Valore') || 0),
                      deadline: formatDateStr(getCol(row, 'Data Consegna')),
                      creationDate: formatDateStr(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0],
                      priority: existingJob?.priority || 3
                  };
                  jobsBatchMap.set(jobId, jobData);
                  lastJobContext = { id: jobId, code: code };
              }

              if (lastJobContext && operatorRaw && hoursRaw) {
                  const hours = parseHours(hoursRaw);
                  if (hours > 0) {
                      const opName = String(operatorRaw).trim();
                      let emp = employees.find(e => e.name.toLowerCase().includes(opName.toLowerCase())) || 
                                Array.from(empsBatchMap.values()).find(e => e.name.toLowerCase().includes(opName.toLowerCase()));
                      
                      if (!emp) {
                          const newEmpId = "imp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
                          emp = {
                              id: newEmpId,
                              name: opName,
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

                      const logDate = formatDateStr(getCol(row, 'Data Inizio')) || new Date().toISOString().split('T')[0];
                      logsBatchList.push({
                          id: `log-${lastJobContext.id}-${emp.id}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                          jobId: lastJobContext.id,
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
          
          if (jobsBatchMap.size > 0 || logsBatchList.length > 0) {
              try {
                  await dbService.bulkImport(
                      Array.from(jobsBatchMap.values()), 
                      logsBatchList, 
                      Array.from(empsBatchMap.values())
                  );
                  alert(`Importazione riuscita!\n- Commesse: ${jobsCreated} nuove, ${jobsUpdated} aggiornate\n- Ore registrate: ${logsCreated}\n- Nuovi dipendenti: ${empsBatchMap.size}`);
                  window.location.reload();
              } catch (err) {
                  console.error("Errore Database:", err);
                  alert("Errore tecnico durante il salvataggio su Firebase. Verifica la console.");
              }
          } else {
              alert("Nessun dato valido trovato nel file.");
          }
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

  // ==========================================
  // LOGICA CALCOLO ORE RIGOROSA (SNAP 15m/30m)
  // ==========================================
  const calculateDailyStats = (empId: string, dateStr: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { standardHours: 0, overtime: 0, isLate: false, isAnomaly: false, isAbsent: false, firstIn: null, lastOut: null, lunchOut: null, lunchIn: null, records: [], justification: null, firstInId: null, lunchOutId: null, lunchInId: null, lastOutId: null };

    const overtimeSnap = settings.overtimeSnapMinutes || 30;
    const permessoSnap = settings.permessoSnapMinutes || 15;
    const latenessSnap = 15;

    const dayAttendance = attendance
      .filter(a => a.employeeId === empId && a.timestamp.startsWith(dateStr))
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const justification = justifications.find(j => j.employeeId === empId && j.date === dateStr);
    const dateObj = new Date(dateStr);
    const todayStr = new Date().toISOString().split('T')[0];
    const isWorkDay = (emp.workDays || [1,2,3,4,5]).includes(dateObj.getDay());

    const parseTimeStr = (t: string | undefined | null) => { 
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number); 
        return h * 60 + m; 
    };

    const getMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

    const schStartM = parseTimeStr(emp.scheduleStartMorning || "08:30");
    const schEndM = parseTimeStr(emp.scheduleEndMorning || "12:30");
    const schStartA = parseTimeStr(emp.scheduleStartAfternoon || "13:30");
    const schEndA = parseTimeStr(emp.scheduleEndAfternoon || "17:30");
    const tolerance = emp.toleranceMinutes || 0;

    let firstInMins: number | null = null, firstInId = null;
    let lunchOutMins: number | null = null, lunchOutId = null;
    let lunchInMins: number | null = null, lunchInId = null;
    let lastOutMins: number | null = null, lastOutId = null;

    if (dayAttendance[0]?.type === 'ENTRATA') {
        firstInMins = getMinutes(new Date(dayAttendance[0].timestamp));
        firstInId = dayAttendance[0].id;
    }
    
    if (dayAttendance.length === 2) {
        if (dayAttendance[1].type === 'USCITA') {
            lastOutMins = getMinutes(new Date(dayAttendance[1].timestamp));
            lastOutId = dayAttendance[1].id;
        }
    } else if (dayAttendance.length >= 3) {
        if (dayAttendance[1].type === 'USCITA') {
            lunchOutMins = getMinutes(new Date(dayAttendance[1].timestamp));
            lunchOutId = dayAttendance[1].id;
        }
        if (dayAttendance[2].type === 'ENTRATA') {
            lunchInMins = getMinutes(new Date(dayAttendance[2].timestamp));
            lunchInId = dayAttendance[2].id;
        }
        if (dayAttendance[3]?.type === 'USCITA') {
            lastOutMins = getMinutes(new Date(dayAttendance[3].timestamp));
            lastOutId = dayAttendance[3].id;
        }
    }

    let standardMinutes = 0;
    let overtimeHours = 0;

    const getEffectiveStart = (real: number, sched: number) => {
        if (real <= sched + tolerance) return sched;
        return sched + (Math.ceil((real - sched) / latenessSnap) * latenessSnap);
    };

    const getEffectiveEnd = (real: number, sched: number) => {
        if (real >= sched) return sched;
        const missing = sched - real;
        const snappedMissing = Math.ceil(missing / permessoSnap) * permessoSnap;
        return sched - snappedMissing;
    };

    if (firstInMins !== null) {
        const start = getEffectiveStart(firstInMins, schStartM);
        const morningExit = lunchOutMins !== null ? lunchOutMins : (lunchInMins === null ? lastOutMins : null);
        if (morningExit !== null) {
            const end = getEffectiveEnd(morningExit, schEndM);
            if (end > start) standardMinutes += (end - start);
        }
    }

    let afterStartMins: number | null = null;
    if (lunchInMins !== null) {
        afterStartMins = getEffectiveStart(lunchInMins, schStartA);
    } else if (firstInMins !== null && lastOutMins !== null && lastOutMins > schStartA && lunchOutMins === null) {
        afterStartMins = getEffectiveStart(Math.max(firstInMins, schStartA), schStartA);
    }

    if (afterStartMins !== null && lastOutMins !== null) {
        const end = getEffectiveEnd(lastOutMins, schEndA);
        if (end > afterStartMins) standardMinutes += (end - afterStartMins);
    }

    if (lastOutMins !== null && lastOutMins > schEndA) {
        const extra = lastOutMins - schEndA;
        overtimeHours = (Math.floor(extra / overtimeSnap) * overtimeSnap) / 60;
    }

    let isLate = false;
    if (firstInMins !== null && firstInMins > schStartM + tolerance) isLate = true;

    const finalStandardHours = Math.round((standardMinutes / 60) * 100) / 100;

    return { 
        standardHours: finalStandardHours, 
        overtime: overtimeHours, 
        isLate, 
        isAnomaly: dateStr < todayStr && dayAttendance.length > 0 && dayAttendance.length % 2 !== 0 && dateObj.getDay() !== 0 && dateObj.getDay() !== 6,
        isAbsent: dateStr < todayStr && isWorkDay && dayAttendance.length === 0 && !justification,
        firstIn: firstInMins !== null ? new Date(dayAttendance[0].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lunchOut: lunchOutMins !== null ? new Date(dayAttendance[1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lunchIn: lunchInMins !== null ? new Date(dayAttendance[2].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        lastOut: lastOutMins !== null ? new Date(dayAttendance[dayAttendance.length-1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
        firstInId, lunchOutId, lunchInId, lastOutId, 
        records: dayAttendance, 
        justification 
    };
  };

  const getPayrollData = () => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const daysInMonth = new Date(year, month, 0).getDate();
     return employees.map(emp => {
         let totalWorked = 0, totalOvertime = 0, ferieCount = 0, malattiaCount = 0, festivoCount = 0, congedoCount = 0, permessoHours = 0, lateCount = 0, absenceCount = 0, daysWorked = 0;
         
         const parseTime = (t: string | undefined) => { 
             const timeStr = t || "00:00";
             const [h, m] = timeStr.split(':').map(Number); 
             return (h || 0) * 60 + (m || 0); 
         };
         
         const morningExpected = parseTime(emp.scheduleEndMorning || "12:30") - parseTime(emp.scheduleStartMorning || "08:30");
         const afternoonExpected = parseTime(emp.scheduleEndAfternoon || "17:30") - parseTime(emp.scheduleStartAfternoon || "13:30");
         const dailyContractualHours = Math.max(0, (morningExpected + afternoonExpected) / 60);

         for(let d=1; d<=daysInMonth; d++) {
             const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
             const stats = calculateDailyStats(emp.id, dateStr);
             const dateObj = new Date(dateStr);
             const isWorkDay = (emp.workDays || [1,2,3,4,5]).includes(dateObj.getDay());

             totalWorked += stats.standardHours;
             totalOvertime += stats.overtime;
             if (stats.standardHours > 0) daysWorked++;
             if (stats.isLate) lateCount++;
             
             if (stats.isAbsent || (stats.justification && stats.justification.type === JustificationType.INGIUSTIFICATO)) {
                 absenceCount++;
             }

             if (stats.justification) {
                 if (stats.justification.type === JustificationType.FERIE) ferieCount++;
                 if (stats.justification.type === JustificationType.MALATTIA) malattiaCount++;
                 if (stats.justification.type === JustificationType.FESTIVO) festivoCount++;
                 if (stats.justification.type === JustificationType.CONGEDO) congedoCount++;
             }

             // --- LOGICA CALCOLO PERMESSI (GAP ORE) ---
             const isCoveredByOther = stats.justification && 
                 [JustificationType.FERIE, JustificationType.MALATTIA, JustificationType.FESTIVO, JustificationType.INGIUSTIFICATO, JustificationType.CONGEDO].includes(stats.justification.type);
             
             if (isWorkDay && !isCoveredByOther) {
                 if (stats.justification?.type === JustificationType.PERMESSO) {
                     permessoHours += Math.max(0, dailyContractualHours - stats.standardHours);
                 } 
                 else if (stats.standardHours > 0 && stats.standardHours < dailyContractualHours) {
                     permessoHours += (dailyContractualHours - stats.standardHours);
                 }
             }
         }
         permessoHours = Math.round(permessoHours * 100) / 100;
         return { ...emp, totalWorked, totalOvertime, ferieCount, malattiaCount, festivoCount, congedoCount, permessoHours, lateCount, absenceCount, daysWorked };
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
          'Festività (gg)': stat.festivoCount,
          'Congedo (gg)': stat.congedoCount,
          'Permessi (h)': stat.permessoHours,
          'Assenze Ing. (gg)': stat.absenceCount,
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

  if (availableTabs.length === 0 && !isGodMode) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
              <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm max-w-md">
                  <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
                  <p className="text-slate-600 mb-6 italic">Il tuo profilo non ha permessi configurati per accedere alla Dashboard Amministrativa.</p>
                  <p className="text-sm text-slate-400">Contatta l'amministratore del sistema.</p>
              </div>
          </div>
      );
  }

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
                </div>
            </div>
            {/* KPI Cards... */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 print:hidden">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">Commesse Attive</p><h3 className="text-2xl font-bold text-slate-800">{overviewJobStats.filter(j => j.status === JobStatus.IN_PROGRESS).length}</h3></div>
                        <Briefcase className="text-blue-500 bg-blue-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">In Imballaggio</p><h3 className="text-2xl font-bold text-orange-600">{packagingJobs.length}</h3></div>
                        <Package className="text-orange-500 bg-orange-50 p-2 rounded-lg" size={40} />
                    </div>
                    {packagingJobs.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 border-t pt-2 max-h-20 overflow-y-auto">
                            {packagingJobs.map(j => <div key={j.id} className="truncate">• {j.code} - <span className="font-semibold">{j.clientName}</span></div>)}
                        </div>
                    )}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">Valore Produzione</p><h3 className="text-2xl font-bold text-slate-800">€ {overviewJobStats.reduce((acc, j) => acc + j.budgetValue, 0).toLocaleString()}</h3></div>
                        <TrendingUp className="text-green-500 bg-green-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div><p className="text-slate-500 text-sm font-medium">Commesse a Rischio</p><h3 className="text-2xl font-bold text-red-600">{overviewJobStats.filter(j => j.profitMargin < 0 || j.isOverBudget).length}</h3></div>
                        <AlertTriangle className="text-red-500 bg-red-50 p-2 rounded-lg" size={40} />
                    </div>
                </div>
            </div>
            {/* Charts... */}
            </>
        )}
        
        {activeTab === 'JOBS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                    <div className="flex items-center gap-4 flex-wrap flex-1">
                        <h3 className="font-bold text-slate-700">Analisi Dettagliata Commesse</h3>
                        {/* Search and Date filters... */}
                    </div>
                    <div className="flex gap-2">{isGodMode && <button onClick={() => handleExcelExportJobs(sortedJobStats)} className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-100 border border-green-200 transition"><FileSpreadsheet size={16}/> Esporta Excel</button>}</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 w-10 whitespace-nowrap"><input type="checkbox" className="rounded border-slate-300" onChange={(e) => {if(e.target.checked) setSelectedJobIds(new Set(sortedJobStats.map(j => j.id))); else setSelectedJobIds(new Set());}} checked={selectedJobIds.size === sortedJobStats.length && sortedJobStats.length > 0}/></th>
                                <th onClick={() => requestSort('code', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Commessa {renderSortArrow('code', jobSort)}</th>
                                <th onClick={() => requestSort('clientName', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Cliente {renderSortArrow('clientName', jobSort)}</th>
                                <th onClick={() => requestSort('totalHoursUsed', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Ore {renderSortArrow('totalHoursUsed', jobSort)}</th>
                                <th onClick={() => requestSort('deadline', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Scadenza {renderSortArrow('deadline', jobSort)}</th>
                                <th onClick={() => requestSort('budgetValue', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Valore {renderSortArrow('budgetValue', jobSort)}</th>
                                <th onClick={() => requestSort('profitMargin', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Risultato {renderSortArrow('profitMargin', jobSort)}</th>
                                <th onClick={() => requestSort('marginPercentage', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Margine % {renderSortArrow('marginPercentage', jobSort)}</th>
                                <th onClick={() => requestSort('status', jobSort, setJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100 whitespace-nowrap tracking-wider">Stato {renderSortArrow('status', jobSort)}</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedJobStats.map((job) => (
                                <tr key={job.id} className={`hover:bg-slate-50 ${selectedJobIds.has(job.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300" checked={selectedJobIds.has(job.id)} onChange={(e) => {const newSet = new Set(selectedJobIds); if (e.target.checked) newSet.add(job.id); else newSet.delete(job.id); setSelectedJobIds(newSet);}}/></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)}>{job.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{job.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500"><div className="flex items-center gap-2"><div className="w-16 bg-slate-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${job.isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((job.totalHoursUsed / job.budgetHours) * 100, 100)}%` }}></div></div><span>{job.totalHoursUsed.toFixed(1)}/{job.budgetHours}</span></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{job.deadline ? new Date(job.deadline).toLocaleDateString('it-IT') : '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">€ {job.budgetValue.toLocaleString()}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${job.profitMargin < 0 ? 'text-red-600' : 'text-green-600'}`}>€ {job.profitMargin.toLocaleString()}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${job.marginPercentage < 0 ? 'text-red-600' : 'text-green-600'}`}>{job.marginPercentage.toFixed(1)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.status === JobStatus.IN_PROGRESS ? 'bg-green-100 text-green-800' : job.status === JobStatus.PLANNED ? 'bg-blue-100 text-blue-800' : job.status === JobStatus.COMPLETED ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}>{job.status}</span></td>
                                    <td className="px-6 py-4 text-right"><Info size={16} className="text-slate-400 hover:text-blue-500 cursor-pointer" onClick={() => setSelectedJobForAnalysis(job.id)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Detail Modal... */}
            </div>
        )}

        {activeTab === 'HR' && (
             <div className="space-y-6">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <Calendar className="text-blue-600"/>
                    <label className="text-sm font-medium text-slate-700">Mese di Competenza:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-slate-300 rounded px-2 py-1"/>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-700">Riepilogo Presenze Mensile</h3><button onClick={handleExportSummary} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition"><FileSpreadsheet size={16}/> Export Riepilogo Paghe</button></div>
                    <table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Dipendente</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Giorni Pres.</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Ore Ordinarie</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Straordinari</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Assenze/Ferie/Mal./Fest./Cong.</th><th className="px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-slate-200">{payrollStats.map(stat => (<tr key={stat.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium text-slate-900">{stat.name}<div className="text-xs text-slate-400">{stat.role}</div></td><td className="px-6 py-4 text-slate-500">{stat.daysWorked}</td><td className="px-6 py-4 font-bold text-slate-700">{stat.totalWorked.toFixed(2)}</td><td className="px-6 py-4 text-slate-500">{stat.totalOvertime > 0 ? <span className="text-orange-600 font-bold">{stat.totalOvertime.toFixed(2)}</span> : '-'}</td><td className="px-6 py-4 text-xs space-y-1">
                        {stat.absenceCount > 0 && <div className="text-red-600 font-bold">Assenze Ing.: {stat.absenceCount} gg</div>}
                        {stat.ferieCount > 0 && <div className="text-blue-600">Ferie: {stat.ferieCount} gg</div>}
                        {stat.malattiaCount > 0 && <div className="text-purple-600">Malattia: {stat.malattiaCount} gg</div>}
                        {stat.festivoCount > 0 && <div className="text-orange-600">Festivo: {stat.festivoCount} gg</div>}
                        {stat.congedoCount > 0 && <div className="text-teal-600">Congedo: {stat.congedoCount} gg</div>}
                    </td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedEmpForDetail(stat.id)} className="bg-slate-100 hover:bg-blue-50 text-blue-600 px-3 py-1 rounded border border-slate-200 text-sm font-medium transition">Gestisci / Cartellino</button></td></tr>))}</tbody></table>
                </div>
                {/* Cartellino Modal... */}
                {selectedEmpForDetail && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl"><div><h3 className="text-2xl font-bold text-slate-800">{employees.find(e => e.id === selectedEmpForDetail)?.name}</h3><p className="text-slate-500 text-sm">Cartellino Presenze: {new Date(selectedMonth).toLocaleDateString('it-IT', {month:'long', year:'numeric'})}</p></div><div className="flex gap-2"><button onClick={() => handleExportTimecard(selectedEmpForDetail)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><FileSpreadsheet size={18}/> Scarica Excel</button><button onClick={() => setSelectedEmpForDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24} className="text-slate-500"/></button></div></div>
                            <div className="flex-1 overflow-auto p-6"><table className="w-full text-sm border-collapse"><thead><tr className="bg-slate-100 text-slate-600 border-b border-slate-300"><th className="p-2 border border-slate-200 text-left whitespace-nowrap">Data</th><th className="p-2 border border-slate-200 text-center w-20 whitespace-nowrap">Entrata</th><th className="p-2 border border-slate-200 text-center w-20 whitespace-nowrap">Uscita (P)</th><th className="p-2 border border-slate-200 text-center w-20 whitespace-nowrap">Entrata (P)</th><th className="p-2 border border-slate-200 text-center w-20 whitespace-nowrap">Uscita</th><th className="p-2 border border-slate-200 text-center w-20 bg-blue-50 font-bold text-blue-800 whitespace-nowrap">Ore Ord.</th><th className="p-2 border border-slate-200 text-center w-20 bg-orange-50 font-bold text-orange-800 whitespace-nowrap">Straord.</th><th className="p-2 border border-slate-200 text-center w-24 whitespace-nowrap">Giustificativo</th><th className="p-2 border border-slate-200 text-center w-16 whitespace-nowrap">Note</th></tr></thead><tbody>{Array.from({length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()}, (_, i) => i + 1).map(day => {const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`; const stats = calculateDailyStats(selectedEmpForDetail, dateStr); const dateObj = new Date(dateStr); const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6; let rowClass = "hover:bg-slate-50"; if (isWeekend) rowClass = "bg-slate-50 text-slate-400"; if (stats.isAbsent) rowClass = "bg-red-50"; if (stats.isAnomaly) rowClass = "bg-orange-50"; return (<tr key={day} className={`border-b border-slate-200 ${rowClass}`}><td className="p-2 border border-slate-200"><div className="font-bold">{String(day).padStart(2,'0')}</div><div className="text-xs uppercase">{dateObj.toLocaleDateString('it-IT', {weekday:'short'})}</div></td><td className={`p-1 border border-slate-200 text-center ${stats.isLate ? 'text-orange-600 font-bold' : ''}`}><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.firstIn || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.firstInId, 'ENTRATA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lunchOut || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lunchOutId, 'USCITA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lunchIn || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lunchInId, 'ENTRATA')} /></td><td className="p-1 border border-slate-200 text-center"><TimeInput className="w-full text-center bg-transparent border-transparent focus:border-blue-500 rounded px-1 outline-none text-xs" value={stats.lastOut || ''} onChange={(val) => handleTimeChange(selectedEmpForDetail, dateStr, val, stats.lastOutId, 'USCITA')} /></td><td className="p-2 border border-slate-200 text-center font-bold">{stats.standardHours > 0 ? stats.standardHours.toFixed(2) : '-'}</td><td className="p-2 border border-slate-200 text-center text-orange-600 font-bold">{stats.overtime > 0 ? stats.overtime.toFixed(2) : ''}</td><td className="p-2 border border-slate-200 text-center"><select className={`w-full text-xs p-1 border rounded ${stats.justification ? 'bg-blue-100 font-bold text-blue-800 border-blue-300' : 'bg-white'}`} value={stats.justification?.type || ''} onChange={(e) => {if (e.target.value) setJustificationForDay(selectedEmpForDetail, dateStr, e.target.value as JustificationType); else onSaveJustification({ ...stats.justification!, id: `${selectedEmpForDetail}-${dateStr}`, type: JustificationType.STANDARD });}}><option value="">-</option><option value={JustificationType.FERIE}>FERIE</option><option value={JustificationType.MALATTIA}>MALATTIA</option><option value={JustificationType.PERMESSO}>PERMESSO</option><option value={JustificationType.FESTIVO}>FESTIVO</option><option value={JustificationType.CONGEDO}>CONGEDO</option><option value={JustificationType.INGIUSTIFICATO}>INGIUSTIFICATO</option></select></td><td className="p-2 border border-slate-200 text-center text-xs">{stats.isLate && <span className="block text-orange-600 font-bold">RITARDO</span>}{stats.isAbsent && <span className="block text-red-600 font-bold">ASSENZA</span>}{stats.isAnomaly && <span className="block text-orange-500 font-bold">ANOMALIA</span>}</td></tr>)})}</tbody></table></div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {/* Tab Fleet and AI... */}

        {activeTab === 'MANAGE' && (
            <div className="space-y-6">
                <div className="flex gap-4 mb-6"><button onClick={() => setManageSubTab('JOBS')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'JOBS' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Commesse</button>{(canManageEmployees || isSystem) && <button onClick={() => setManageSubTab('EMPLOYEES')} className={`px-4 py-2 rounded-lg font-medium transition ${manageSubTab === 'EMPLOYEES' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Gestione Dipendenti</button>}</div>
                {manageSubTab === 'JOBS' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Elenco Commesse</h2>
                            {/* Filters... */}
                        </div>
                        {isEditingJob && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                                    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{isEditingJob.id ? 'Modifica Commessa' : 'Nuova Commessa'}</h3><button onClick={() => setIsEditingJob(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700">Codice</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.code || ''} onChange={e => setIsEditingJob({...isEditingJob, code: e.target.value})} /></div>
                                        <div><label className="block text-sm font-medium text-slate-700">Cliente</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.clientName || ''} onChange={e => setIsEditingJob({...isEditingJob, clientName: e.target.value})} /></div>
                                        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700">Descrizione</label><input type="text" className="w-full border p-2 rounded" value={isEditingJob.description || ''} onChange={e => setIsEditingJob({...isEditingJob, description: e.target.value})} /></div>
                                        {/* Other job fields... */}
                                    </div>
                                    <div className="mt-6 flex justify-end gap-2"><button onClick={() => setIsEditingJob(null)} className="px-4 py-2 border rounded hover:bg-slate-50">Annulla</button><button onClick={handleSaveJobForm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button></div>
                                </div>
                            </div>
                        )}
                        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th onClick={() => requestSort('code', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer whitespace-nowrap">Codice {renderSortArrow('code', manageJobSort)}</th><th onClick={() => requestSort('clientName', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer whitespace-nowrap">Cliente {renderSortArrow('clientName', manageJobSort)}</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Descrizione</th><th onClick={() => requestSort('priority', manageJobSort, setManageJobSort)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer whitespace-nowrap">Priorità {renderSortArrow('priority', manageJobSort)}</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Data Inizio</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Budget/Valore</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Stato</th><th className="px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-slate-200">{sortedManageJobs.map((job) => (<tr key={job.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-medium text-slate-900">{job.code}</td><td className="px-6 py-4 text-slate-500">{job.clientName}</td><td className="px-6 py-4 text-slate-400 text-xs truncate max-w-[200px]" title={job.description}>{job.description}</td><td className="px-6 py-4 text-slate-500 flex gap-1">{Array.from({length: job.priority || 3}).map((_, i) => <Star key={i} size={12} className="fill-orange-400 text-orange-400"/>)}</td><td className="px-6 py-4 text-slate-500 text-xs">{job.creationDate ? new Date(job.creationDate).toLocaleDateString('it-IT') : '-'}</td><td className="px-6 py-4 text-slate-500">{job.budgetHours}h / €{job.budgetValue}</td><td className="px-6 py-4"><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{job.status}</span></td><td className="px-6 py-4 flex gap-2">
                            <button onClick={() => setIsEditingJob(job)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18}/></button>
                            {!job.isArchived && job.status === JobStatus.COMPLETED && (
                                <button onClick={() => handleArchiveJob(job)} className="text-slate-400 hover:text-orange-600" title="Archivia"><Archive size={18}/></button>
                            )}
                            {job.isArchived && (
                                <button onClick={() => handleRestoreJob(job)} className="text-orange-600 hover:text-green-600" title="Ripristina da Archivio"><RotateCcw size={18}/></button>
                            )}
                        </td></tr>))}
                        {sortedManageJobs.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-8 text-slate-400 italic">Nessuna commessa trovata.</td></tr>
                        )}
                        </tbody></table></div>
                    </div>
                )}
                {/* Employees subtab... */}
            </div>
        )}
        {/* Rest of the component... */}
      </div>
    </div>
  );
};

export default AdminDashboard;
